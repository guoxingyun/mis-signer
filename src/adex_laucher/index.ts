import to from 'await-to-js';
import NP from 'number-precision';

import Exchange from './Exchange';

import DBClient from '../adex/models/db';
import Utils from '../adex/api/utils';
import MistConfig from '../cfg';
import {Logger} from '../common/Logger';
import LogUnhandled from '../common/LogUnhandled';

import {AsimovWallet} from '@fingo/asimov-wallet';

class Launcher {
    private db: DBClient;
    private utils: Utils;
    private tmpTransactionId;
    private relayer: AsimovWallet;
    private mist: Exchange;
    private errorCount: number = 0;
    // 5分钟无log输出会杀死进程。
    private logger: Logger = new Logger(Launcher.name, 5 * 60 * 1000);

    constructor() {
        this.db = new DBClient();
        this.utils = new Utils();

        this.relayer = new AsimovWallet({
            name: 'Exchange_Relayer',
            rpc: MistConfig.asimov_child_rpc,
            pk: MistConfig.relayers[0].prikey,
        });
        this.mist = new Exchange(MistConfig.ex_address, this.relayer);
    }

    async start() {
        while (true) {
            const start = new Date();
            this.logger.log(`Main loop started at:${start.toString()}ms`);
            const [err] = await to(this.mainLoop());
            if (err) {
                this.logger.log(`Catched Main Loop Error:${err}`);
            }
            this.logger.log(
                `Main loop finished in:${new Date().getTime() - start.getTime()}ms`
            );
        }
    }

    async sleep(ms: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }

    countError(err: Error) {
        this.errorCount++;
        if (this.errorCount > 100) {
            this.logger.log(
                'Too many db errors, kill process, goodbye...',
                this.errorCount,
                err
            );
            // Maybe you shold kill the process
            process.exit(-1);
        } else {
            this.logger.log('Count Error', this.errorCount, err);
        }
    }

    async mainLoop(): Promise<void> {
        const [trades_err, trades] = await to(this.db.get_laucher_trades());
        if (trades_err) {
            this.logger.log('get_laucher_trades error', trades_err, trades);
            this.countError(trades_err);
            return await this.sleep(500);
        }

        if (!trades || trades.length <= 0) {
            this.logger.log('No matched trades');
            return await this.sleep(1000);
        }

        const current_time = this.utils.get_current_time();
        // 只要进入laucher阶段就先把状态设置为pending
        // 防止engine那边在laucher的时候，继续在当前transaction_id里继续插数据
        this.tmpTransactionId = trades[0].transaction_id;

        const update_trade_info = [
            'pending',
            undefined,
            current_time,
            trades[0].transaction_id,
        ];
        const [launchUpdateErr, launchUpdateRes] = await to(
            this.db.launch_update_trades(update_trade_info)
        );
        if (launchUpdateErr || !launchUpdateRes) {
            return await this.sleep(500);
        }

        // 准备laucher之前先延时2秒,waiting locked in db?
        // mt 3s 一个块，所以目前问题不大。
        // 但是utxo已经主动拆分，其实可以更快速度进行launch，按目前的拆分可以一个块提交10个以内交易。
        await this.sleep(500);
        return await this.doLaunch(trades, current_time);
    }

    async doLaunch(trades, current_time): Promise<void> {
        const [tx_trades_err, tx_trades] = await to(
            this.db.transactions_trades([this.tmpTransactionId])
        );
        if (!tx_trades || tx_trades_err) {
            this.logger.log(
                '[ADEX LAUNCHER]::(transactions_trades):',
                tx_trades_err,
                tx_trades
            );
            return;
        }
        const processOrders = await this.generateProcessOrders(tx_trades);
        const [err, txid] = await to(this.mist.matchorder(processOrders));

        if (!err) {
            const updatedInfo = [
                'pending',
                txid,
                current_time,
                trades[0].transaction_id,
            ];
            await this.db.begin();
            const [updatedInfoErr, updatedInfoResult] = await to(
                this.db.launch_update_trades(updatedInfo)
            );
            if (!updatedInfoResult) {
                this.logger.log(
                    `[ADEX LAUCNER]:launch_update_trades failed %o`,
                    updatedInfoErr
                );
                await this.db.rollback();
                return;
            }

            const TXinfo = [
                trades[0].transaction_id,
                txid,
                trades[0].market_id,
                'pending',
                'pending',
                current_time,
                current_time,
            ];
            const [insertTransactionsErr, insertTransactionsResult] = await to(
                this.db.insert_transactions(TXinfo)
            );
            if (!insertTransactionsResult) {
                this.logger.log(
                    `[ADEX LAUCNER]:launch_update_trades failed %o`,
                    insertTransactionsErr
                );
                await this.db.rollback();
                return;
            }
            await this.db.commit();
        } else {
            this.logger.log(
                `[ADEX LAUNCHER] call dex matchorder err=${err}
                transaction_id=${trades[0].transaction_id}
                relayers=${this.relayer.address}`
            );
            const errInfo = ['matched', null, current_time, trades[0].transaction_id];
            const [errUpdateErr,errUpdateRes] = await to(this.db.launch_update_trades(errInfo));
            if(errUpdateErr) {
                this.logger.log(`[ADEX LAUNCHER] call dex matchorder err=${errUpdateErr}`);
            }
        }
        // 500ms的作用：1、为等待pg磁盘写入的时间，2、防止laucher过快，watcher跟不上，因为wathcer的需要链上确认
        return await this.sleep(500);
    }

    async generateProcessOrders(tx_trades) {
        const processOrders = [];
        const [markets_err, markets] = await to(this.db.list_online_markets());
        if (!markets) {
            this.logger.log(
                '[ADEX LAUNCHER]::(list_online_markets):',
                markets_err,
                markets
            );
            return;
        }
        for (const oneTrade of tx_trades) {
            let token_address;
            for (const j in markets) {
                if (oneTrade.market_id === markets[j].id) {
                    token_address = markets[j];
                }
            }
            if (!token_address) {
                this.logger.log('not supported token_address');
                continue;
            }

            const base_amount = Math.round(NP.times(+oneTrade.amount, 100000000));
            const quote_amount = Math.round(NP.times(+oneTrade.amount, +oneTrade.price, 100000000));

            //    let taker = ["0x66a7bc2e2041d7d15fdfae69bbce9bbbecefc8704c",10,12,time,"ASIM-BTC","sell"]
            const takerOrder = await this.db.find_order([oneTrade.taker_order_id]);
            const makerOrder = await this.db.find_order([oneTrade.maker_order_id]);
            const takerProcessOrder = [
                takerOrder[0].trader_address,
                Math.round(NP.times(takerOrder[0].amount, 100000000)),
                Math.round(NP.times(takerOrder[0].price, 100000000)),
                +takerOrder[0].expire_at,
                takerOrder[0].market_id,
                takerOrder[0].side,
            ];

            const makerProcessOrder = [
                makerOrder[0].trader_address,
                Math.round(NP.times(makerOrder[0].amount, 100000000)),
                Math.round(NP.times(makerOrder[0].price, 100000000)),
                +makerOrder[0].expire_at,
                makerOrder[0].market_id,
                makerOrder[0].side,
            ];


            const trade_info = [takerProcessOrder,
                makerProcessOrder,
                base_amount,
                quote_amount,
                Math.round(NP.times(+oneTrade.price, 100000000)),
                token_address.base_token_address,
                token_address.quote_token_address,
                oneTrade.taker_side,
                takerOrder[0].signature,
                makerOrder[0].signature
            ];
            /*
                taker: one_trade.taker,
                maker: one_trade.maker,
                base_token_address: token_address.base_token_address,
                quote_token_address: token_address.quote_token_address,
                expire_at: token_address.quote_token_address,
                base_token_amount: base_amount,
                quote_token_amount: quote_amount,
                side: one_trade.taker_side,
            */
            processOrders.push(trade_info);
        }
        return processOrders;
    }
}


LogUnhandled(Launcher.name);
const launcher = new Launcher();
launcher.start();
