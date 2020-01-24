import { Router } from 'express';
import to from 'await-to-js';
import NP from 'number-precision';
import { AsimovWallet, AsimovConst } from '@fingo/asimov-wallet';
import * as cryptoSha256 from 'crypto';

import { chain } from './api/chain';

import fake_token from './contract/AssetToken';

import mist_config from '../cfg';
import adex_utils from '../adex/api/utils';
import psql from '../adex/models/db';
import mist_wallet1 from '../adex/api/mist_wallet';
import users from '../adex/cli/users';

const Coin2AssetFee = [
    {
        token: 'CNYC',
        amount: 10,
    },
    {
        token: 'USDT',
        amount: 1.5,
    },
    {
        token: 'ASIM',
        amount: 0.6,
    },
    {
        token: 'MT',
        amount: 0.2,
    },
    {
        token: 'ETH',
        amount: 0.01,
    },
    {
        token: 'BTC',
        amount: 0.0002,
    },
];

export default () => {
    const wallet = Router();

    const psql_db = new psql();
    const utils = new adex_utils();
    const mist_wallet = new mist_wallet1();



    wallet.all('/get_user_info/:address', async (req, res) => {
        const token_arr = await mist_wallet.list_tokens();
        let mist_user = await psql_db.find_user([req.params.address]);
        const users_obj = new users();
        if (!mist_user[0]) {
            const infos = [];
            for (const i in token_arr as any[]) {
                if( !token_arr[i])continue
                const total_balance = await users_obj.get_total_balance(
                    token_arr[i],
                    req.params.address
                );

                const price = await mist_wallet.get_token_price2pi(token_arr[i].symbol);
                const valuation = NP.times(price, total_balance);
                mist_user = {
                    address: req.params.address,
                    token_symbol: token_arr[i].symbol,
                    balance: total_balance,
                    valuation,
                };
                infos.push(mist_user);
            }
            mist_user = {
                address: infos[0].address,
                pi: infos[0].balance,
                asim: infos[1].balance,
                usdt: infos[3].balance,
                eth: infos[4].balance,
                mt: infos[5].balance,
                btc: infos[2].balance,
                pi_valuation: infos[0].valuation,
                asim_valuation: infos[1].valuation,
                usdt_valuation: infos[3].valuation,
                eth_valuation: infos[4].valuation,
                mt_valuation: infos[5].valuation,
                btc_valuation: infos[2].valuation,
            };
        }
        // PI,ASIM,BTC.USDT,ETH,MT
        res.json({ result: mist_user });
    });

    wallet.all('/list_assets_info', async (req, res) => {
        const [err, info] = await to(psql_db.list_assets_info());
        res.json({ result: info, err });
    });

    wallet.all('/get_asset_info/:token_name', async (req, res) => {
        const tokens = await psql_db.get_tokens([req.params.token_name]);
        res.json({ result:tokens[0], err:null });
    });


    // 资产转币币
    wallet.all(
        '/sendrawtransaction/asset2coin/:amount/:address/:token_name/:sign_data',
        async (req, res) => {
            const sign_data = [req.params.sign_data];
            const [err, result] = await to(chain.sendrawtransaction(sign_data));
            if (!err) {
                const token_info = await psql_db.get_tokens([req.params.token_name]);
                console.log('sss--', token_info);
                const current_time = utils.get_current_time();
                const info = {
                    id: null,
                    address: req.params.address,
                    asim_token_name: req.params.token_name,
                    erc20_totken_name: req.params.token_name,
                    // side: coin2asset,asset2coin
                    side: 'asset2coin',
                    asim_token_contract: token_info[0].asim_address,
                    asim_token_id: token_info[0].asim_assetid,
                    erc20_token_contract: token_info[0].address,
                    status: 'successful',
                    txid: result,
                    amount: req.params.amount,
                    fee_token: 'ASIM',
                    fee_token_amount: 0.2,
                    created_at: current_time,
                };
                if (err) {
                    info.status = 'failed';
                }
                info.id = utils.get_hash(info);
                const arr_info = utils.arr_values(info);
                const [err2, result2] = await to(psql_db.insert_converts(arr_info));
                if (err2) console.log(err2, result2);
            }
            res.json({ result, err });
        }
    );
    // 币币转资产
    wallet.all(
        '/sendrawtransaction/coin2asset/:amount/:address/:token_name/:sign_data',
        async (req, res) => {
            const sign_data = [req.params.sign_data];
            const [err, result] = await to(chain.sendrawtransaction(sign_data));
            if (!err) {
                const token_info = await psql_db.get_tokens([req.params.token_name]);
                const current_time = utils.get_current_time();
                const info = {
                    id: null,
                    address: req.params.address,
                    asim_token_name: req.params.token_name,
                    erc20_totken_name: req.params.token_name,
                    // side: coin2asset,asset2coin
                    side: 'coin2asset',
                    asim_token_contract: token_info[0].asim_address,
                    asim_token_id: token_info[0].asim_assetid,
                    erc20_token_contract: token_info[0].address,
                    status: 'successful',
                    txid: result,
                    amount: req.params.amount,
                    fee_token: 'ASIM',
                    fee_token_amount: 0.2,
                    created_at: current_time,
                };
                if (err) {
                    info.status = 'failed';
                }
                info.id = utils.get_hash(info);
                const arr_info = utils.arr_values(info);
                const [err2, result2] = await to(psql_db.insert_converts(arr_info));
                if (err2) console.log(err2, result2);
            }
            res.json({ result, err });
        }
    );
    // 划转记录
    wallet.all('/my_converts/:address', async (req, res) => {
        const [err, result] = await to(psql_db.my_converts([req.params.address]));
        res.json({ result, err });
    });

    wallet.all('/my_converts2/:address/:page/:perpage', async (req, res) => {
        const { address, page, perpage } = req.params;
        const offset = (+page - 1) * +perpage;
        const [err, result] = await to(
            psql_db.my_converts2([address, offset, perpage])
        );
        res.json({ result, err });
    });

    // 只有广播失败和解析失败的的不存表，其他会存
    wallet.all(
        '/sendrawtransaction/asset2coin_v2/:sign_data',
        async (req, res) => {
            const sign_data = [req.params.sign_data];
            const [master_err, master_txid] = await to(
                chain.sendrawtransaction(sign_data)
            );

            if (master_err === undefined) {
                // 临时代码
                const current_time = utils.get_current_time();
                const tmp_info = {
                    txid: master_txid,
                    time: current_time,
                };
                const tmp_id = utils.get_hash(tmp_info);

                setTimeout(async () => {
                    const [decode_err, decode_info] = await to(
                        utils.decode_transfer_info(master_txid)
                    );
                    const {
                        from,
                        asset_id,
                        vin_amount,
                        to_amount,
                        remain_amount,
                        fee_amount,
                        fee_asset,
                    } = decode_info;

                    if (decode_err) {
                        console.log(
                            'utils.decode_transfer_info error',
                            decode_err,
                            decode_info,
                            vin_amount,
                            to_amount,
                            remain_amount
                        );
                        return res.json({
                            success: false,
                            err: decode_err.message,
                        });
                    }

                    if (decode_info.to !== mist_config.bridge_address) {
                        return res.json({
                            success: false,
                            err: 'reciver ' + decode_info.to + ' is not official address',
                        });
                    }

                    const transfer_tokens = await psql_db.get_tokens([asset_id]);
                    const fee_tokens = await psql_db.get_tokens([fee_asset]);
                    const awallet = new AsimovWallet({
                        name: 'test',
                        rpc: mist_config.asimov_child_rpc,
                        mnemonic: mist_config.bridge_word,
                    });

                    const [child_err, child_txid] = await to(
                        awallet.contractCall.call(
                            transfer_tokens[0].address,
                            'mint(address,uint256)',
                            [from, NP.times(to_amount, 100000000)],
                            AsimovConst.DEFAULT_GAS_LIMIT,
                            0,
                            AsimovConst.DEFAULT_ASSET_ID,
                            AsimovConst.DEFAULT_FEE_AMOUNT,
                            AsimovConst.DEFAULT_ASSET_ID,
                            AsimovConst.CONTRACT_TYPE.CALL
                        )
                    );
                    if (child_err)
                        console.log('child_err,child_txid', child_err, child_txid);

                    const info = {
                        id: null,
                        address: from,
                        token_name: transfer_tokens[0].symbol,
                        amount: to_amount,
                        side: 'asset2coin',
                        master_txid,
                        master_txid_status: 'successful',
                        child_txid,
                        child_txid_status:
                            child_txid === undefined ? 'failed' : 'successful',
                        fee_asset: fee_tokens[0].symbol,
                        fee_amount,
                    };
                    info.id = tmp_id;
                    const info_arr = utils.arr_values(info);
                    const [err3, result3] = await to(psql_db.insert_bridge(info_arr));
                    if (err3) console.log(err3, result3);
                    return res.json({
                        success: err3 === undefined ? true : false,
                        err: err3,
                    });
                }, 10000);
                // ? 为什么要等10秒执行，等待一个块确认？
                return res.json({ success: true, id: tmp_id });
            }

            res.json({ success: false, err: master_err });
        }
    );

    wallet.all('/sendrawtransaction/coin2asset_v2', async (req, res) => {
        const { signature, address, token_name, amount, expire_time } = req.body;
        const current_time = new Date().getTime();
        if (+current_time > +expire_time) {
            return res.json({ success: false, err: 'sign data expire' });
        }

        const tokens = await psql_db.get_tokens([token_name]);

        const info = [
            'MIST_BURN',
            tokens[0].address,
            mist_config.bridge_address,
            amount,
            expire_time,
        ];
        const str = info.join('');
        const root_hash = cryptoSha256.createHmac('sha256', '123');
        const hash = root_hash.update(str, 'utf8').digest('hex');

        const result = utils.verify(hash, signature);
        if (!result) {
            return res.json({
                success: false,
                err: 'verify failed',
            });
        }

        const child_wallet = new AsimovWallet({
            name: 'test',
            rpc: mist_config.asimov_child_rpc,
            mnemonic: mist_config.bridge_word,
        });

        const [child_err, child_txid] = await to(
            child_wallet.contractCall.call(
                tokens[0].address,
                'burn(address,uint256)',
                [address, NP.times(amount, 100000000)],
                AsimovConst.DEFAULT_GAS_LIMIT,
                0,
                AsimovConst.DEFAULT_ASSET_ID,
                AsimovConst.DEFAULT_FEE_AMOUNT,
                AsimovConst.DEFAULT_ASSET_ID,
                AsimovConst.CONTRACT_TYPE.CALL
            )
        );

        if (child_err) console.log('child_err---child_txid', child_err, child_txid);

        const master_wallet = new AsimovWallet({
            name: 'test3',
            rpc: mist_config.asimov_master_rpc,
            mnemonic: mist_config.bridge_word,
            // storage: 'localforage',
        });
        await master_wallet.account.createAccount();
        const [master_err, master_txid] = await to(
            master_wallet.commonTX.transfer(address, amount, tokens[0].asim_assetid)
        );

        if (master_err)
            console.log(
                'err,master_txid',
                master_err,
                master_txid,
                tokens[0].asim_assetid
            );

        //
        const insert_info = {
            id: null,
            address,
            token_name: tokens[0].symbol,
            amount,
            side: 'coin2asset',
            master_txid,
            master_txid_status: 'successful',
            child_txid,
            child_txid_status: child_txid === undefined ? 'failed' : 'successful',
            fee_asset: 'ASIM',
            fee_amount: 0.02,
        };
        insert_info.id = utils.get_hash(insert_info);
        const info_arr = utils.arr_values(insert_info);
        const [err3, result3] = await to(psql_db.insert_bridge(info_arr));

        if (err3) console.log(err3, result3);

        return res.json({
            success: result3 === undefined ? false : true,
            id: insert_info.id,
        });
    });

      /**
       * @api {post} /wallet/sendrawtransaction/asset2coin_v3/:sign_data 广播资产划转
       * @apiDescription 广播币币资产的划入，并且进行托管资产的划出
       * @apiName asset2coin_v3
       * @apiGroup wallet
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       {
          "success": true,
          "id": "eac9fee0a83dd7ebc2ba67012b14175f2fddf3eabbcfe435cb11f105101af46d"
      }
       * @apiSampleRequest https://poa.mist.exchange/api/wallet/sendrawtransaction/asset2coin_v3/
       * @apiVersion 1.0.0
       */

    // 划转操作？
    // 只有广播失败和解析失败的的不存表，其他会存
    wallet.all(
        '/sendrawtransaction/asset2coin_v3/:sign_data',
        async (req, res) => {
            const sign_data = [req.params.sign_data];
            const [master_err, master_txid] = await to(
                chain.sendrawtransaction(sign_data)
            );

            if (master_err === undefined) {
                // 临时代码，这个临时代码具体需要改动什么？
                const info = {
                    id: null,
                    address: null,
                    token_name: null,
                    amount: null,
                    side: 'asset2coin',
                    master_txid,
                    master_txid_status: 'pending',
                    child_txid: null,
                    child_txid_status: 'pending',
                    fee_asset: null,
                    fee_amount: null,
                };
                info.id = utils.get_hash(info);
                const info_arr = utils.arr_values(info);
                const [err3, result3] = await to(psql_db.insert_bridge(info_arr));
                if (err3) console.log(err3, result3);

                setTimeout(async () => {
                    const [decode_err, decode_info] = await to(
                        utils.decode_transfer_info(master_txid)
                    );
                    const {
                        from,
                        asset_id,
                        vin_amount,
                        to_amount,
                        remain_amount,
                        fee_amount,
                        fee_asset,
                    } = decode_info;
                    if (decode_err) console.log(decode_err, vin_amount, remain_amount);

                    let master_txid_status;
                    if (!decode_err) {
                        master_txid_status = 'successful';
                    } else {
                        master_txid_status = 'illegaled';
                    }

                    if (decode_info.to !== mist_config.bridge_address) {
                        master_txid_status = 'illegaled';
                        console.error(`reciver ${decode_info.to}  is not official address`);
                        return; // 应该要return吧这里
                    }

                    const transfer_tokens = await psql_db.get_tokens([asset_id]);
                    const fee_tokens = await psql_db.get_tokens([fee_asset]);

                    const current_time = utils.get_current_time();
                    const update_info = {
                        address: from,
                        token_name: transfer_tokens[0].symbol,
                        amount: to_amount,
                        master_txid_status,
                        child_txid_status: 'pending',
                        fee_asset: fee_tokens[0].symbol,
                        fee_amount,
                        updated_at: current_time,
                        id: info.id,
                    };
                    const update_info_arr = utils.arr_values(update_info);
                    const [err4, result4] = await to(
                        psql_db.update_asset2coin_decode(update_info_arr)
                    );
                    if (err4)
                        console.log('psql_db.update_asset2coin_decode----', err3, result4);
                }, 10000);
                // FIXME:这里又有一个等待10秒的非严谨逻辑处理

                return res.json({ success: true, id: info.id });
            }

            res.json({ success: false, err: master_err });
        }
    );

    /**
       * @api {post} /wallet/sendrawtransaction/coin2asset_v3/ 广播币币划转
       * @apiDescription 广播币币资产的划入，并且进行托管资产的划出
       * @apiName coin2asset_v3
       * @apiGroup wallet
       * @apiParam {json} signature 签名信息
       * @apiParam {string} address 兑入地址
       * @apiParam {string} token_name  目标币种
       * @apiParam {string} amount  兑换数量
       * @apiParam {string} expire_time  过期时间
       @apiParamExample {json} Request-Example:
       {"signature":
      {
              "r": "9ab18bf2783b6586391ea190c2b31ef060347dd085071f849e5c8909aa09f201",
              "s": "8732b9921e50ea6de592dcfa6c90c3214b6424aecf3388a7d1064828a0307ca",
              "pubkey": "02078e749afa7a3e869f8b2889aedd637adae74134165810f03e72e98a0564c0de"
          },
       "address":"0x6632bd37c1331b34359920f1eaa18a38ba9ff203e9",
       "token_name":"ETH",
       "amount":"0.08",
       "expire_time":"1577755470236"
    }
       *
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       {
      "success": true,
      "id": "aa5a2f00f03616f02bde85b5a804d096ff4a23a227a8c972d26e26ba486ba940"
  }
       * @apiSampleRequest https://poa.mist.exchange/api/wallet/sendrawtransaction/coin2asset_v3
       * @apiVersion 1.0.0
       */

    wallet.all('/sendrawtransaction/coin2asset_v3', async (req, res) => {
        const { signature, address, token_name, amount, expire_time } = req.body;
        const current_time = new Date().getTime();
        if (+current_time > +expire_time) {
            return res.json({ success: false, err: 'sign data expire' });
        }

        const tokens = await psql_db.get_tokens([token_name]);

        const info = [
            'MIST_BURN',
            tokens[0].address,
            mist_config.bridge_address,
            amount,
            expire_time,
        ];
        const str = info.join('');
        const root_hash = cryptoSha256.createHmac('sha256', '123');
        const hash = root_hash.update(str, 'utf8').digest('hex');

        const result = utils.verify(hash, signature);
        if (!result) {
            return res.json({
                success: false,
                err: 'verify failed',
            });
        }
        let fee_amount = 0;
        for (const fee of Coin2AssetFee) {
            if (token_name === fee.token) {
                fee_amount = fee.amount;
                if (amount <= fee_amount) {
                    return res.json({
                        success: false,
                        err: 'fee is not enough',
                    });
                }
            }
        }

        const insert_info = {
            id: null,
            address,
            token_name: tokens[0].symbol,
            amount: NP.minus(amount, fee_amount),
            side: 'coin2asset',
            master_txid: null,
            master_txid_status: 'pending',
            child_txid: null,
            child_txid_status: 'pending',
            fee_asset: tokens[0].symbol,
            fee_amount,
        };

        insert_info.id = utils.get_hash(insert_info);
        const info_arr = utils.arr_values(insert_info);
        const [err3, result3] = await to(psql_db.insert_bridge(info_arr));

        if (err3) console.log(err3);

        return res.json({
            success: result3 === undefined ? false : true,
            id: result3 === undefined ? '' : insert_info.id,
        });
    });

    wallet.all(
        '/burn_coin_tohex/:address/:token_name/:amount',
        async (req, res) => {
            const { address, token_name, amount } = req.params;
            const expire_time = 600;
            const tokens = await psql_db.get_tokens([token_name]);

            const awallet = new AsimovWallet({
                name: address,
                rpc: mist_config.asimov_child_rpc,
                address,
            });

            const balance = await awallet.contractCall.callReadOnly(
                tokens[0].address,
                'balanceOf(address)',
                [address]
            );

            const available_amount = NP.divide(balance, 100000000);

            if (available_amount < amount) {
                return res.json({
                    success: false,
                    err: `Lack of balance,you have ${available_amount} ${token_name} but want spend ${amount}`,
                });
            }

            if (expire_time <= 0 || expire_time > 3600) {
                return res.json({
                    success: false,
                    err: 'the expire_time must be less than 1 hour and more than 0',
                });
            }

            const expire_at = new Date().getTime() + expire_time * 1000;
            const info = [
                'MIST_BURN',
                tokens[0].address,
                mist_config.bridge_address,
                amount,
                expire_at,
            ];

            const str = info.join('');
            const root_hash = cryptoSha256.createHmac('sha256', '123');
            const hash = root_hash.update(str, 'utf8').digest('hex');

            res.json({
                success: true,
                hash,
                expire_at,
            });
        }
    );

    /**
       * @api {post} /wallet/find_convert/:id 划转订单详情
       * @apiDescription 单笔划转订单的详情
       * @apiName find_convert
       * @apiGroup wallet
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       {
      "success": true,
      "result": [
          {
              "id": "8c4ddabebe95718a37aea074120d3bd133196c01812935ddef42dffcdfd431ac",
              "address": "0x6602ca6e2820ec98cc68909fdd9f87c7bd23b62000",
              "token_name": "ETH",
              "amount": 1,
              "side": "asset2coin",
              "master_txid": "225a905c4e7fe2579f0217b49af2496f57424e512eacf2718ef2348a28cabb68",
              "master_txid_status": "successful",
              "child_txid": "dc5bf2c1208a832d898bff32e7118f0d558b8c66e26c4bb1e729f3caeebffffe",
              "child_txid_status": "successful",
              "fee_asset": "ASIM",
              "fee_amount": "0.00105252",
              "updated_at": "2019-12-18T10:06:45.317Z",
              "created_at": "2019-12-18T10:06:34.273Z"
          },
      "err": null
  }
       * @apiSampleRequest https://poa.mist.exchange/api/wallet/find_convert/8c4ddabebe95718a37aea074120d3bd133196c01812935ddef42dffcdfd431ac
       * @apiVersion 1.0.0
       */

    wallet.all('/find_convert/:id', async (req, res) => {
        const [err, convert] = await to(psql_db.find_bridge([req.params.id]));
        if (err) {
            return res.json({
                success: false,
                err,
            });
        } else if (convert && convert.length === 0) {
            return res.json({
                success: true,
                result: [],
            });
        } else {
            return res.json({
                success: true,
                result: convert[0],
            });
        }
    });

    /**
       * @api {post} /wallet/my_converts_v3/:address/:page/:perpage 全币种用户划转记录
       * @apiDescription 获取用户的所有币种的币币划转和资产划转的记录分页查询
       * @apiName my_converts_v2
       * @apiGroup wallet
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       {
      "success": true,
      "result": [
          {
              "id": "8c4ddabebe95718a37aea074120d3bd133196c01812935ddef42dffcdfd431ac",
              "address": "0x6602ca6e2820ec98cc68909fdd9f87c7bd23b62000",
              "token_name": "ETH",
              "amount": 1,
              "side": "asset2coin",
              "master_txid": "225a905c4e7fe2579f0217b49af2496f57424e512eacf2718ef2348a28cabb68",
              "master_txid_status": "successful",
              "child_txid": "dc5bf2c1208a832d898bff32e7118f0d558b8c66e26c4bb1e729f3caeebffffe",
              "child_txid_status": "successful",
              "fee_asset": "ASIM",
              "fee_amount": "0.00105252",
              "updated_at": "2019-12-18T10:06:45.317Z",
              "created_at": "2019-12-18T10:06:34.273Z"
          }
      ],
      "err": null
  }
       * @apiSampleRequest https://poa.mist.exchange/api/wallet/my_converts_v2/0x6602ca6e2820ec98cc68909fdd9f87c7bd23b62000/1/10
       * @apiVersion 1.0.0
       */

    wallet.all('/my_converts_v2/:address/:page/:perpage', async (req, res) => {
        const { address, page, perpage } = req.params;
        const offset = (+page - 1) * +perpage;
        const [err, result] = await to(
            psql_db.my_bridge([address, offset, perpage])
        );
        const success = result === undefined ? false : true;
        res.json({ success, result, err });
    });

    /**
       * @api {post} /wallet/my_converts_v3/:address/:token_name/:page/:perpage 单币种用户划转记录
       * @apiDescription 获取用户的指定币种的币币划转和资产划转的记录分页查询
       * @apiName my_converts_v3
       * @apiGroup wallet
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       {
      "success": true,
      "result": [
          {
              "id": "8c4ddabebe95718a37aea074120d3bd133196c01812935ddef42dffcdfd431ac",
              "address": "0x6602ca6e2820ec98cc68909fdd9f87c7bd23b62000",
              "token_name": "ETH",
              "amount": 1,
              "side": "asset2coin",
              "master_txid": "225a905c4e7fe2579f0217b49af2496f57424e512eacf2718ef2348a28cabb68",
              "master_txid_status": "successful",
              "child_txid": "dc5bf2c1208a832d898bff32e7118f0d558b8c66e26c4bb1e729f3caeebffffe",
              "child_txid_status": "successful",
              "fee_asset": "ASIM",
              "fee_amount": "0.00105252",
              "updated_at": "2019-12-18T10:06:45.317Z",
              "created_at": "2019-12-18T10:06:34.273Z"
          }
      ],
      "err": null
  }
       * @apiSampleRequest https://poa.mist.exchange/api/wallet/my_converts_v3/0x6602ca6e2820ec98cc68909fdd9f87c7bd23b62000/ETH/1/10
       * @apiVersion 1.0.0
       */

    wallet.all(
        '/my_converts_v3/:address/:token_name/:page/:perpage',
        async (req, res) => {
            const { address, token_name, page, perpage } = req.params;
            const offset = (+page - 1) * +perpage;
            const [err, result] = await to(
                psql_db.my_bridge_v3([address, token_name, offset, perpage])
            );
            const success = result === undefined ? false : true;
            res.json({ success, result, err });
        }
    );

    /**
       * @api {post} /wallet/Coin2AssetFee_config 币币划转手续费
       * @apiDescription 获取币币划转的手续费信息
       * @apiName Coin2AssetFee_config
       * @apiGroup wallet
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       {
      "success": true,
      "result": [
          {
              "token": "CNYC",
              "amount": 10
          },
          {
              "token": "USDT",
              "amount": 1.5
          },
          {
              "token": "ASIM",
              "amount": 0.6
          },
          {
              "token": "MT",
              "amount": 0.2
          },
          {
              "token": "ETH",
              "amount": 0.01
          },
          {
              "token": "BTC",
              "amount": 0.0002
          }
      ]
  }
       * @apiSampleRequest https://poa.mist.exchange/api/wallet/Coin2AssetFee_config
       * @apiVersion 1.0.0
       */

    wallet.all('/Coin2AssetFee_config', async (req, res) => {
        res.json({
            success: true,
            result: Coin2AssetFee,
        });
    });

    wallet.all('/sendrawtransaction/:sign_data', async (req, res) => {
        const sign_data = [req.params.sign_data];
        const [err, result] = await to(chain.sendrawtransaction(sign_data));
        res.json({ result, err });
    });

    wallet.all('/list_cdp_info', async (req, res) => {
        const [err, result] = await to(psql_db.list_cdp());
        res.json({ result, err });
    });

    wallet.all('/get_blockchain_info', async (req, res) => {
        const [err, result] = await to(chain.getblockchaininfo());
        const [err2, result2] = await to(
            chain.getblockchaininfo(undefined, 'child_poa')
        );

        if (err2) console.error(err2);

        res.json({ result, result2, err });
    });

    /**
       * @api {post} /wallet/my_bridge_length/:address 获取闪兑订单的记录条数
       * @apiDescription 获取fingo相关配置
       * @apiName my_bridge_length
       * @apiGroup wallet
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       *  {
              "success": true,
              "result": "30",
              "err": null
       *  }
       * @apiSampleRequest https://poa.mist.exchange/api/wallet/my_bridge_length/0x66ea4b7f7ad33b0cc7ef94bef71bc302789b815c46
       * @apiVersion 1.0.0
       */

    wallet.all('/my_bridge_length/:address', async (req, res) => {
        const { address } = req.params;
        const [err, result] = await to(psql_db.my_bridge_length([address]));

        return res.json({
            success: result === undefined ? false : true,
            result,
            err,
        });
    });

    /**
       * @api {post} /wallet/list_fingo_config 获取fingo相关配置
       * @apiDescription 获取fingo相关配置
       * @apiName list_fingo_config
       * @apiGroup wallet
       * @apiSuccess {json} result
       * @apiSuccessExample {json} Success-Response:
       *  {
              "success": true,
              "result": "15.70000000",
              "err": null
          *  }
          * @apiSampleRequest https://poa.mist.exchange/api/express/get_price/ASIM/CNYC/1
          * @apiVersion 1.0.0
          */

    wallet.all('/list_fingo_config', async (req, res) => {
        const conf = {
            dex_address: mist_config.ex_address,
            express_address: mist_config.express_address,
            asimov_chain_rpc: mist_config.asimov_chain_rpc,
            bridge_address: mist_config.bridge_address,
        };

        res.json({
            success: true,
            result: conf,
        });
    });

    return wallet;
};