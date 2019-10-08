import to from 'await-to-js'

export default class db{
        clientDB;
        constructor() {
                const pg=require('pg')
                        var conString = "postgres://postgres:postgres@127.0.0.1/postgres?sslmode=disable";
                let client = new pg.Client(conString);
                client.connect(function(err) {
                                if(err) {
                                return console.error('连接postgreSQL数据库失败', err);
                                }   
                                });
                this.clientDB  = client;
        }

        /**
         *orders
         *
         *
         *
         *
         *
		 */
		async insert_order(ordermessage) {

			let [err,result] = await to(this.clientDB.query('insert into mist_orders values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',ordermessage));
			if(err) {
				return console.error('insert_order_查询失败', err);
			}
			console.log('insert_order_成功',JSON.stringify(result.rows)); 
			return JSON.stringify(result.rows);
		}

		async list_orders() {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM mist_orders order by updated_at desc limit 30')); 
			if(err) {
				return console.error('list_order_查询失败', err);
			}
			console.log('list_order_成功',JSON.stringify(result.rows)); 
			return result.rows;

		} 

		async my_orders(address) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM mist_orders where trader_address=$1 order by updated_at desc limit 30',address)); 
			if(err) {
				return console.error('list_order_查询失败', err);
			}
			console.log('list_order_成功',JSON.stringify(result.rows)); 
			return result.rows;

		} 



		async filter_orders(filter) {

			let err;
			let result;
			if(filter[1] == 'sell'){
				[err,result] = await to(this.clientDB.query('SELECT * FROM mist_orders where price<=$1 and side=$2 order by price asc',filter)); 
			}else{
				
				[err,result] = await to(this.clientDB.query('SELECT * FROM mist_orders where price>=$1 and side=$2 order by price desc',filter)); 
			}
			if(err) {
				return console.error('insert_order_查询失败11', err);
			}
			console.log('insert_order',JSON.stringify(result.rows)); 
			return result.rows;

		} 

		
        async update_orders(update_info) {
			let [err,result] = await to(this.clientDB
				.query('UPDATE mist_orders SET (available_amount,confirmed_amount,canceled_amount,\
				pending_amount,updated_at)=(available_amount+$1,confirmed_amount+$2,canceled_amount+$3,pending_amount+$4,$5) WHERE id=$6',update_info)); 

			if(err) {
				return console.error('update_order_查询失败', err);
			}
			console.log('update_order_成功',JSON.stringify(result.rows)); 
			return result.rows;


        } 


        async order_book() {
			let [err,result] = await to(this.clientDB.query('select s.* from  (SELECT price,sum(amount) as amount,side FROM mist_orders\
			where available_amount>0  group by price,side)s order by s.price desc limit 30')); 
			if(err) {
				return console.error('list_order_查询失败', err);
			}
			console.log('list_order_成功',JSON.stringify(result.rows)); 
			return result.rows;
        }

        /*
         *tokens
         *
         * */
        async findtrades(tradeid) {
        }


         /*
         *makkets
         *
         * */
        async list_markets() {
			let [err,result] = await to(this.clientDB.query('select * from mist_markets')); 
			if(err) {
				return console.error('list_order_查询失败', err);
			}
			console.log('list_order_成功',JSON.stringify(result.rows)); 
			return result.rows;

        }


        /*
         *
         *
         *trades
         */
        async insert_trades(trade_info) {
			let [err,result] = await to(this.clientDB.query('insert into mist_trades values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',trade_info));
			if(err) {
				return console.error('insert_traders_查询失败', err);
			}
			console.log('insert_order_成功',JSON.stringify(result.rows)); 
			return JSON.stringify(result.rows);


        } 

		async list_trades() {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM mist_trades order by created_at desc limit 30')); 
			if(err) {
				return console.error('list_order_查询失败', err);
			}
			console.log('list_order_成功',JSON.stringify(result.rows)); 
			return result.rows;

		} 

		async my_trades(address) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM mist_trades where taker=$1 or maker=$1 order by created_at desc limit 30',address)); 
			if(err) {
				return console.error('list_order_查询失败', err);
			}
			console.log('list_order_成功',JSON.stringify(result.rows)); 
			return result.rows;

		} 


         /**
         *lauchers
         *
         *
         * */
          async insert_trade(trademessage) {


        } 

         /**
         *transactions
         *
         *
         * */
          async insert_transactions(TXinfo) {
			let [err,result] = await to(this.clientDB.query('insert into mist_transactions values($1,$2,$3,$4,$5)',TXinfo));
			if(err) {
				return console.error('insert_traders_查询失败', err);
			}
			console.log('insert_order_成功',JSON.stringify(result.rows)); 
			return JSON.stringify(result.rows);
        } 

        /**
         *watchers
         *
         *
         * */
          async insert_watcher(message) {
        } 

}
