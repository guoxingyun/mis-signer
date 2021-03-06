import DBClient from '../models/db';
import NP from '../../common/NP';

import Utils from './utils';
import to from 'await-to-js';

import * as Queue from 'bull';
import * as process from 'process';
import {IOrder, IOrderBook} from '../interface';
import mistConfig, {BullOption} from '../../cfg';
import {promisify} from 'util';
import * as Kafka from 'node-rdkafka'
import {ILocalBook} from '../../interface';
import Token from '../../wallet/contract/Token';

const FREEZE_PREFIX = 'freeze::';

async function updateCancelFreeze(trader_address, amount, price, side, market_id, redisClient): Promise<void> {
    const [baseToken, quoteToken] = market_id.split('-');
    if (side === 'buy') {
       // const quoteRes:ILocalBook = await hgetAsync(trader_address, quoteToken);
       // quoteRes.freezeAmount = NP.plus(quoteRes.freezeAmount, NP.times(price, amount));
        const localBook = await Token.getLocalBook(quoteToken,redisClient,trader_address);
        localBook.freezeAmount = NP.plus(localBook.freezeAmount, NP.times(price, amount));
        await Token.setLocalBook(quoteToken,redisClient,trader_address,localBook);
    } else if (side === 'sell') {
        /*
        const baseRes = await hgetAsync(key, baseToken);
        const baseAmount = baseRes.toString();
        await redisClient.HMSET(key, baseToken, NP.plus(baseAmount, amount));
        // tslint:disable-next-line:no-empty
         */
        const localBook = await Token.getLocalBook(baseToken,redisClient,trader_address);
        localBook.freezeAmount = NP.plus(localBook.freezeAmount, amount);
        await Token.setLocalBook(baseToken,redisClient,trader_address,localBook);
    } else {
        const errorMessage = `Unsupported types ${side}`;
        console.error(errorMessage);
        throw Error(errorMessage);
    }
    return;
}

export default class Order {

    private db: DBClient;
    private orderQueue: Queue.Queue;
    private orderBookUpdateQueue: Queue.Queue;
    private utils: Utils;
    private streams:any[] = [];


    constructor(client) {
        this.db = client;
        this.utils = new Utils();
        this.createQueue();
    }

    createQueue(): Queue.Queue {
        this.orderQueue = new Queue('OrderQueue' + process.env.MIST_MODE, BullOption);
        this.orderBookUpdateQueue = new Queue('addOrderBookQueue', BullOption);

        this.orderQueue.on('error', async e => {
            console.log('[SIGNER_API] Queue on Error', e);
            console.log('[SIGNER_API] Goodbye...');

            // kill instance when queue on error
            process.exit(-1);
        });

        this.orderBookUpdateQueue.on('error', async e => {
            console.log('[SIGNER_API] Queue on Error', e);
            console.log('[SIGNER_API] Goodbye...');

            // kill instance when queue on error
            process.exit(-1);
        });
        return this.orderQueue;
    }

    async createKafkaStreams() {
        const markets = await this.db.list_markets();
        for (const market of markets) {
            const kafkaStream = Kafka.createWriteStream({
                'client.id': 'mist',
                'metadata.broker.list': 'localhost:9092'
            }, {}, {
                topic: market.id
            });
            this.streams.push(kafkaStream);
        }
    }

    private async checkQueueStatus(): Promise<boolean> {
        const job = await this.orderQueue.add(null, {removeOnComplete: true, delay: 9999});
        await job.remove();
        return true;
    }

    async queueWaitingCount(): Promise<number> {
        const [err, num] = await to(this.orderQueue.getWaitingCount());
        if (err) {
            return Number.MAX_SAFE_INTEGER;
        }
        return num;
    }

    async build(message): Promise<any> {
        if(process.env.MIST_MODE !== 'k8s' && this.streams.length === 0){
            await this.createKafkaStreams();
        }
        const job = await this.orderQueue.add(message, {removeOnComplete: true});

        const {trader_address, id, amount, price, side, market_id} = message;
        for (const stream of this.streams) {
            if(process.env.MIST_MODE !== 'k8s'){
                if (market_id === stream.topicName) {
                    message.created_at = this.utils.get_current_time();
                    message.updated_at = this.utils.get_current_time();
                    const info = this.utils.arr_values(message);
                    // await this.db.insert_order_v3(info);
                    const queuedSuccess = stream.write(Buffer.from(JSON.stringify(message)));
                    if (queuedSuccess) {
                        console.log('We queued our message!');
                    } else {
                        console.error('Too many messages in our queue already',message);
                    }
                    break;
                }
            }
        }
        return job;
    }

    async cancle(message): Promise<any> {
        if(process.env.MIST_MODE !== 'k8s' && this.streams.length === 0){
            await this.createKafkaStreams();
        }
        for (const stream of this.streams) {
            if(process.env.MIST_MODE !== 'k8s'){
                if (message.market_id === stream.topicName) {
                    message.created_at = this.utils.get_current_time();
                    message.updated_at = this.utils.get_current_time();
                    const info = this.utils.arr_values(message);
                    // await this.db.insert_order_v3(info);
                    const queuedSuccess = stream.write(Buffer.from(JSON.stringify(message)));
                    if (queuedSuccess) {
                        console.log('We queued our message!');
                    } else {
                        console.error('Too many messages in our queue already',message);
                    }
                    break;
                }
            }
        }
        return await this.orderQueue.add(message, {removeOnComplete: true});
    }

    async cancle_order(message, redisClient): Promise<any> {
        const {trader_address, amount, price, side, market_id, id,status} = message;
        const create_time = this.utils.get_current_time();
        const cancle_info = [-message.amount, 0, message.amount, 0, status, create_time, message.id];
        await this.db.update_orders(cancle_info);
        let book;
        if (message.side === 'buy') {
            book = {
                asks: [],
                bids: [[message.price, -message.amount]]
            }
        } else {
            book = {
                asks: [[message.price, -message.amount]],
                bids: []
            }
        }

        const marketUpdateBook = {
            data: book,
            id: message.market_id,
        }
        await this.orderBookUpdateQueue.add(marketUpdateBook, {removeOnComplete: true});
        // cancle解冻，加上负值
        await updateCancelFreeze(trader_address, -amount, price, side, market_id, redisClient);
        return;
    }
    async my_orders_v3(address: string, page: number, perPage: number, status1: string, status2: string, MarketID: string, side: string, start: Date, end: Date): Promise<IOrder[]> {
        const offset = (page - 1) * perPage;
        // @ts-ignore
        const orders = await this.db.my_orders6([address, offset, perPage, status1, status2, start, end, MarketID, side]);
        for (const oneOrder of orders) {
            const trades: any[] = await this.db.order_trades([oneOrder.id]);
            if (trades.length === 0) {
                oneOrder.average_price = '--';
                oneOrder.confirm_value = '--';
                continue;
            }
            let amount = '0';
            let value = '0';
            for (const trade of trades) {
                amount = NP.plus(amount, trade.amount);
                const trade_value = NP.times(trade.amount, trade.price);
                value = NP.plus(value, trade_value);
            }
            oneOrder.average_price = parseFloat(NP.divide(value, amount)).toFixed(8);
            oneOrder.confirm_value = parseFloat(value).toFixed(8);
        }

        return orders;
    }

    async order_book(marketID: string, precision: string): Promise<IOrderBook> {
        const result = await this.db.get_order_book_tmp([marketID, precision]);
        const bookObj = JSON.parse(result[0].order_book);
        return bookObj;
    }

    async order_book_v2(marketID: string, precision: string): Promise<IOrderBook> {

        const asks = await this.db.order_book(['sell', marketID, precision]);
        const bids = await this.db.order_book(['buy', marketID, precision]);

        const asks_arr = [];
        const bids_arr = [];
        for (const item of asks) {
            if (!item) continue
            const askPriceAdd = NP.divide(1, Math.pow(10, +precision));
            item.price = parseFloat(NP.plus(item.price, askPriceAdd)).toFixed(+precision).toString();
            asks_arr.push(this.utils.arr_values(item));
        }

        for (const item2 of bids) {
            if (!item2) continue
            bids_arr.push(this.utils.arr_values(item2));
        }

        const order_book = {
            asks: asks_arr.reverse(),
            bids: bids_arr,
        };
        return order_book;
    }

    async get_order(order_id: string): Promise<IOrder[]> {
        return await this.db.find_order([order_id]);
    }

}

// 回滚没有打包成功的交易,不过吃单变成了挂单，等别人吃
export async function restore_order(db, order_id, amount) {
    const utils = new Utils();
    const update_time = utils.get_current_time();
    const current_order = await db.find_order([order_id]);

    const status = current_order[0].available_amount + amount < current_order[0].amount ? 'partial_filled' : 'pending';
    const update_orders_info = [amount, 0, 0, -amount, status, update_time, order_id];
    await db.update_orders(update_orders_info);
}
