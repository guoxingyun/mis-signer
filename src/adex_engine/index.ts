import client from '../adex/models/db'
import engine from '../adex/api/engine'
import utils2 from '../adex/api/utils'
import * as Queue from 'bull'
import NP from 'number-precision'
import to from 'await-to-js'

class enginer {

    private orderQueue;
    private db;
    private exchange;
    private utils;

    constructor() {
        this.orderQueue = new Queue('OrderQueue' + process.env.MIST_MODE,
            {
                redis: {
                    port: Number(process.env.REDIS_PORT),
                    host: process.env.REDIS_URL,
                    password: process.env.REDIS_PWD
                }
            });
        this.db = new client();
        this.exchange = new engine(this.db);
        this.utils = new utils2();
        this.start();
    }

    async start() {
        this.orderQueue.process(async (job, done) => {
            console.log(`[ADEX ENGINE]receive a message %o from OrderQueue${process.env.MIST_MODE} \n`, job.data);
            const message = job.data;

            const create_time = this.utils.get_current_time();
            message.created_at = create_time;
            message.updated_at = create_time;

            // 每次匹配100单，超过300的二次匹配直到匹配不到挂单
            while (message.available_amount > 0) {

                const [find_orders_err, find_orders] = await to(this.exchange.match(message));

                if (!find_orders) {
                    console.error('match orders', find_orders_err, find_orders);
                    done();
                    return;
                }

                if (find_orders.length === 0) {
                    break;
                }

                const [trades_err, trades] = await to(this.exchange.make_trades(find_orders, message));
                if (!trades) {
                    console.error('make trades', trades_err, trades);
                    done();
                    return;
                }

                const [call_asimov_err, call_asimov_result] = await to(this.exchange.call_asimov(trades));
                if (call_asimov_err) {
                    console.error('call asimov', call_asimov_err, call_asimov_result);
                    done();
                    return;
                }

                let amount = 0;
                for (const item of trades) {
                    amount = NP.plus(amount, item.amount);
                }

                message.available_amount = NP.minus(message.available_amount, amount);
                message.pending_amount = NP.plus(message.pending_amount, amount);
            }

            if (message.pending_amount === 0) {
                message.status = 'pending';
            } else if (message.available_amount === 0) {
                message.status = 'full_filled';
            } else {
                message.status = 'partial_filled';
            }

            const arr_message = this.utils.arr_values(message);
            const [insert_order_err, insert_order_result] = await to(this.db.insert_order(arr_message));
            if (!insert_order_result) {
                console.error(insert_order_err, insert_order_result);
            }

            done()
        });

    }


}

export default new enginer();
