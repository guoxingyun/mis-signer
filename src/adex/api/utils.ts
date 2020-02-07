/* eslint-disable no-useless-escape */
const crypto = require('crypto');
const date = require('silly-datetime');
const bitcore_lib_1 = require('bitcore-lib');
const ECDSA = bitcore_lib_1.crypto.ECDSA;
const child = require('child_process');
const ethutil = require('ethereumjs-util');
const ethabi = require('ethereumjs-abi');
import NP from 'number-precision';
import mist_config from '../../cfg';

// FIXME: change CUrl to axios

export default class Utils {

    private rootHash;
    constructor() {
        this.rootHash = crypto.createHmac('sha256', '123');
    }

    arr_values(message) {
        const arr_message = [];
        for (const item in message) {
            arr_message.push(message[item]);
        }

        return arr_message;
    }

    get_hash(message) {
        const createTime = this.get_current_time();
        const arr = this.arr_values(message);
        arr.push(createTime);
        const str = arr.join('');

        let rootHash = crypto.createHmac('sha256', '123');
        const hash = rootHash.update(str, 'utf8').digest('hex');
        return hash;

    }

    get_current_time() {
        const milli_seconds = new Date().getMilliseconds();
        const create_time = date.format(new Date(), 'YYYY-MM-DD HH:mm:ss');
        return create_time + '.' + milli_seconds;
    }

    verify(id, sign) {
        const hashbuf = Buffer.alloc(32, id, 'hex');
        const publick = new bitcore_lib_1.PublicKey(sign.pubkey);
        const sig = new bitcore_lib_1.crypto.Signature();
        const r = new bitcore_lib_1.crypto.BN(sign.r, 'hex');
        const s = new bitcore_lib_1.crypto.BN(sign.s, 'hex');
        sig.set({
            r,
            s,
        });
        const result = ECDSA.verify(hashbuf, sig, publick);
        return result;
    }

    async get_receipt(txid) {
        const cmd = 'curl -X POST --data \'\{\"id\":1, \"jsonrpc\":\"2.0\",\"method\":\"asimov_getTransactionReceipt\",\"params\":\[\"' + txid + '\"\]\}\}\' -H \"Content-type: application\/json\" ' + mist_config.asimov_child_rpc;

        const sto = child.execSync(cmd);
        const logs = JSON.parse(sto).result.logs;
        if (logs) {
            console.error(`${cmd} result  have no logs`);
        }
        const datas = [];
        for (const index in logs) {
            datas.push(logs[index].data);
        }
        return datas;
    }

    async get_receipt_log(txid) {
        const cmd = 'curl -X POST --data \'\{\"id\":1, \"jsonrpc\":\"2.0\",\"method\":\"asimov_getTransactionReceipt\",\"params\":\[\"' + txid + '\"\]\}\}\' -H \"Content-type: application\/json\" ' + mist_config.asimov_child_rpc;

        const sto = child.execSync(cmd);
        const logs = JSON.parse(sto).result.logs;
        if (!logs) {
            console.error(`${cmd} result  have no logs`);
        }
        return logs.length > 0 ? 'successful' : 'failed';
    }

    async orderTobytes(order) {

        order.taker = order.taker.substr(0, 2) + order.taker.substr(4, 44);
        order.maker = order.maker.substr(0, 2) + order.maker.substr(4, 44);
        order.baseToken = order.baseToken.substr(0, 2) + order.baseToken.substr(4, 44);
        order.quoteToken = order.quoteToken.substr(0, 2) + order.quoteToken.substr(4, 44);
        order.relayer = order.relayer.substr(0, 2) + order.relayer.substr(4, 44);
        order.takerSide = ethutil.keccak256(order.takerSide);

        let encode = ethabi.rawEncode(['bytes32', 'address', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'bytes32'],
            ['0x45eab75b1706cbb42c832fc66a1bcdaafebcdaea71ed2f08efbf3057c588fcb6',
                order.taker, order.maker, order.baseToken, order.quoteToken, order.relayer, order.baseTokenAmount, order.quoteTokenAmount, order.takerSide]);

        encode = encode.toString('hex').replace(eval(`/00${order.taker.substr(2, 44)}/g`), `66${order.taker.substr(2, 44)}`);
        encode = encode.replace(eval(`/00${order.maker.substr(2, 44)}/g`), `66${order.maker.substr(2, 44)}`);
        encode = encode.replace(eval(`/00${order.baseToken.substr(2, 44)}/g`), `63${order.baseToken.substr(2, 44)}`);
        encode = encode.replace(eval(`/00${order.quoteToken.substr(2, 44)}/g`), `63${order.quoteToken.substr(2, 44)}`);
        encode = '0x' + encode.replace(eval(`/00${order.relayer.substr(2, 44)}/g`), `66${order.relayer.substr(2, 44)}`);

        return encode;
    }

    async orderhashbytes(order) {
        return new Promise((resolve, rejects) => {
            this.orderTobytes(order).then(res => {
                const reshash = ethutil.keccak256(res);
                const buf = Buffer.from('\x19\x01');
                const encode = ethabi.rawEncode(['bytes32', 'bytes32'], ['0x1e026a98781f922f66258de623ab260b5d525da93b3fd8e9b845d83ae3c1711e', reshash]);
                const endencode = '0x' + buf.toString('hex') + encode.toString('hex');
                const endhash = '0x' + ethutil.keccak256(endencode).toString('hex');
                resolve(endhash);
            }).catch(e => {
                rejects(e);
            });
        });
    }

    judge_legal_num(num) {
        let result = true;
        if (num <= 0) {
            result = false;
        } else if (NP.times(num, 10000) !== Math.floor(NP.times(num, 10000))) {
            console.error('cannt support this decimal', num, NP.times(num, 10000), num * 10000);
            result = false;
        }
        return result;
    }

    async decode_transfer_info(txid) {
        const cmd = 'curl -X POST --data \'\{\"id\":1, \"jsonrpc\":\"2.0\",\"method\":\"asimov_getRawTransaction\",\"params\":\[\"' + txid + '\",true,true\]\}\}\' -H \"Content-type: application\/json\" ' + mist_config.asimov_chain_rpc;

        const sto = child.execSync(cmd);
        const txinfo = JSON.parse(sto).result;
        const asset_set = new Set();
        for (const vin of txinfo.vin) {
            asset_set.add(vin.prevOut.asset);
        }

        // vins的所有address和assetid必须一致才去处理,且只考虑主网币做手续费这一种情况
        let vin_amount = 0;
        const from = txinfo.vin[0].prevOut.addresses[0];
        let asset_id;
        for (const vin of txinfo.vin) {
            if (vin.prevOut.addresses[0] !== from) {
                throw new Error('decode failed,inputs contained Multiple addresses');
            } else if (vin.prevOut.asset === '000000000000000000000000' && asset_set.size > 1) {
                console.log('this is a fee utxo');
                continue;
            } else if (vin.prevOut.asset !== '000000000000000000000000' && asset_set.size > 1 && asset_id !== undefined && vin.prevOut.asset !== asset_id) {
                throw new Error('decode failed,inputs contained Multiple asset');
            } else if (asset_id === undefined) {
                asset_id = vin.prevOut.asset;
                vin_amount += +vin.prevOut.value;
            } else if ((asset_id !== undefined && vin.prevOut.asset !== '000000000000000000000000') || asset_set.size === 1) {
                vin_amount += +vin.prevOut.value;
            } else {
                console.log('unknown case happened');
                throw new Error('decode failed');
            }
        }

        // vin里已经排除了多个asset的情况，vout就不判断了
        let vout_remain_amount = 0;
        let vout_to_amount = 0;
        let to_address;
        for (const out of txinfo.vout) {
            if (out.asset === '000000000000000000000000' && out.scriptPubKey.addresses[0] === from) {
                if (asset_set.size === 1) {
                    vout_remain_amount += out.value;
                } else {
                    console.log('this is a fee out');
                }
            } else if (to_address !== undefined && to_address !== out.scriptPubKey.addresses[0] && from !== out.scriptPubKey.addresses[0]) {
                throw new Error('decode failed,outputss contained Multiple addresses');
            } else if (out.scriptPubKey.addresses[0] === from) {
                vout_remain_amount += out.value;
            } else if (to_address === undefined) {
                to_address = out.scriptPubKey.addresses[0];
                vout_to_amount += +out.value;
            } else if (to_address !== undefined && to_address === out.scriptPubKey.addresses[0]) {
                vout_to_amount += +out.value;
            } else {
                throw new Error('decode failed');
            }
        }

        const transfer_info = {
            from,
            to: to_address,
            asset_id: txinfo.vout[0].asset,
            vin_amount: NP.divide(vin_amount, 100000000),
            to_amount: NP.divide(vout_to_amount, 100000000),
            remain_amount: NP.divide(vout_remain_amount, 100000000),
            fee_amount: NP.divide(txinfo.fee[0].value, 100000000),   // TODO: 兼容多个fee的情况
            fee_asset: txinfo.fee[0].asset,
        };

        return transfer_info;
    }

    async decode_erc20_transfer(txid) {
        const cmd = 'curl -X POST --data \'\{\"id\":1, \"jsonrpc\":\"2.0\",\"method\":\"asimov_getTransactionReceipt\",\"params\":\[\"' + txid + '\"\]\}\}\' -H \"Content-type: application\/json\" ' + mist_config.asimov_child_rpc;
        const sto = child.execSync(cmd);
        const logs = JSON.parse(sto).result.logs;
        if (logs) {
            console.error(`${cmd} result  have no logs`);
        }
        const amount = parseInt(logs[0].data, 16);
        const info = {
            contract_address: logs[0].address,
            from: '0x' + logs[0].topics[1].substring(24),
            to: '0x' + logs[0].topics[2].substring(24),
            amount: NP.divide(amount, 100000000),
        };

        return info;
    }

}
