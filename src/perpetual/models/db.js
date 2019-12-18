import to from 'await-to-js'

export default class db{
        clientDB;
        constructor() {
				let db = process.env.MIST_MODE;
				const pg=require('pg')
				var conString = "postgres://postgres:postgres@119.23.181.166/" + db + "?sslmode=disable";
                // var conString = "postgres://postgres:postgres@127.0.0.1/" + db + "?sslmode=disable";
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

			let [err,result] = await to(this.clientDB.query('insert into perpetual_orders values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',ordermessage));
			if(err) {
				return console.error(`insert_order_faied ${err},insert data= ${ordermessage}`);
			}
			console.log('insert_order_成功',JSON.stringify(result.rows)); 
			return JSON.stringify(result.rows);
		}

		async list_orders() {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_orders order by create_at desc limit 30')); 
			if(err) {
				return console.error('list_order_查询失败', err);
			}
			return result.rows;

		} 

		async my_orders(address) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_orders where trader_address=$1 order by updated_at desc limit 30',address)); 
			if(err) {
				return console.error('my_order_查询失败', err,address);
			}
			return result.rows;

		} 

		async my_orders2(filter_info) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_orders where trader_address=$1 and (status=$4 or status=$5)order by updated_at desc limit $3 offset $2',filter_info)); 
			if(err) {
				return console.error('my_order_查询失败', err,filter_info);
			}
			return result.rows;

		} 



		async find_order(order_id) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_orders where id=$1',order_id)); 
			if(err) {
				return console.error('find_order_查询失败', err,order_id);
			}
			return result.rows;

		} 

		async filter_orders(filter) {

			let err;
			let result;
			if(filter[1] == 'sell'){
				[err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_orders where price<=$1 and side=$2 and available_amount>0 and market_id=$3 order by price asc',filter)); 
			}else{
				
				[err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_orders where price>=$1 and side=$2 and available_amount>0 and market_id=$3 order by price desc',filter)); 
			}
			if(err) {
				return console.error('filter_orders_查询失败11',err,filter);
			}
			//console.log('insert_order',JSON.stringify(result.rows)); 
			return result.rows;

		} 

		
        async update_orders(update_info) {
			let [err,result] = await to(this.clientDB
				.query('UPDATE perpetual_orders SET (available_amount,confirmed_amount,canceled_amount,\
				pending_amount,status,updated_at)=(available_amount+$1,confirmed_amount+$2,canceled_amount+$3,pending_amount+$4,$5,$6) WHERE id=$7',update_info)); 

			if(err) {
				return console.error('update_order_查询失败', err,update_info);
			}
			return result.rows;

        } 


		 async update_order_confirm(update_info) {

			let [err,result] = await to(this.clientDB
				.query('UPDATE perpetual_orders SET (available_amount,confirmed_amount,canceled_amount,\
				pending_amount,updated_at)=(available_amount+$1,confirmed_amount+$2,canceled_amount+$3,pending_amount+$4,$5) WHERE id=$6',update_info)); 

			if(err) {
				return console.error('update_order_confirm_查询失败', err,update_info);
			}
			//console.log('update_order_confirm成功',JSON.stringify(result),"info",update_info); 
			return result.rows;

        } 




        async order_book(filter) {
			let err;
			let result;
			if(filter[0] == 'sell'){
				[err,result] = await to(this.clientDB.query('select s.* from  (SELECT price,sum(available_amount) as amount FROM perpetual_orders\
            where available_amount>0  and side=$1 and market_id=$2 group by price)s order by s.price asc limit 100',filter)); 
			}else{
				
				[err,result] = await to(this.clientDB.query('select s.* from  (SELECT price,sum(available_amount) as amount FROM perpetual_orders\
            where available_amount>0  and side=$1 and market_id=$2 group by price)s order by s.price desc limit 100',filter)); 
			}
			if(err) {
				return console.error('filter_orders_查询失败11',err,filter);
			}
			return result.rows;
        }

        /*
         *tokens
         *
         * */
        async list_tokens(tradeid) {
			let [err,result] = await to(this.clientDB.query('select * from perpetual_tokens')); 
			if(err) {
				return console.error('list_tokens_查询失败', err,tradeid);
			}
			return result.rows;

        }

	  async get_tokens(symbol) {
			let [err,result] = await to(this.clientDB.query('select * from perpetual_tokens where symbol=$1',symbol)); 
			if(err) {
				return console.error('get_tokens_查询失败', err,symbol);
			}
			return result.rows;

        }




         /*
         *makkets
         *
         * */
        async list_markets() {
			let [err,result] = await to(this.clientDB.query('select * from perpetual_markets')); 
			if(err) {
				return console.error('list_markets_查询失败', err);
			}
			return result.rows;

        }

		async get_market(marketID) {
			let [err,result] = await to(this.clientDB.query('select * from perpetual_markets where id=$1',marketID)); 
			if(err) {
				return console.error('get_market_查询失败', err,marketID);
			}
			return result.rows;

        }
		
		async get_market_current_price(marketID) {
			//数据后期数据上来了，sql会卡，fixme
			
			let [err,result] = await to(this.clientDB.query('select cast(price as float8) from perpetual_trades where (current_timestamp - created_at) < \'24 hours\' and market_id=$1 order by created_at desc limit 1',marketID)); 
			if(err) {
				return console.error('get_market_current_price_查询失败', err,marketID);
			}
			if(result.rows.length == 0){
				return [{price:0}];
			}
			return result.rows;

        }



		async get_market_quotations(marketID) {

            let [err,result] = await to(this.clientDB.query('select * from (select s.market_id,s.price as current_price,t.price as old_price,(s.price-t.price)/t.price as ratio from (select * from perpetual_trades where market_id=$1 order by created_at desc limit 1)s left join (select * from perpetual_trades where market_id=$1 and (current_timestamp - created_at) > \'24 hours\' order by created_at desc limit 1)t on s.market_id=t.market_id)k left join (select base_token_symbol,quote_token_symbol,id  from    perpetual_markets where id=$1)l on k.market_id=l.id',marketID));
            if(err) {
                return console.error('get_market_quotations_查询失败', err,marketID);
            }

           // console.log('get_market_quotations_成功',JSON.stringify(result.rows));
            return result.rows;

        }


        /*
         *
         *
         *trades
         */
        async insert_trades(trade_info) {
			let [err,result] = await to(this.clientDB.query('insert into perpetual_trades values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',trade_info));
			if(err) {
				return console.error('insert_traders_查询失败', err,trade_info);
			}
			console.log('insert_trades_成功',JSON.stringify(result),"info",trade_info); 
			return JSON.stringify(result.rows);


        } 

		async list_trades(marketID) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_trades where market_id=$1 order by created_at desc limit 30',marketID)); 
			if(err) {
				return console.error('list_trades_查询失败', err,marketID);
			}
			return result.rows;

		} 

		async my_trades(address) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_trades where taker=$1 or maker=$1 order by created_at desc limit 30',address)); 
			if(err) {
				return console.error('my_trades_查询失败', err,address);
			}
			return result.rows;

		} 

		async my_trades2(filter_info) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_trades where taker=$1 or maker=$1 order by created_at desc limit $3 offset $2',filter_info)); 
			if(err) {
				return console.error('my_trades_查询失败', err,filter_info);
			}
			return result.rows;

		} 



		async transactions_trades(id) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_trades where transaction_id=$1',id)); 
			if(err) {
				return console.error('transactions_trades_查询失败', err,id);
			}
			return result.rows;

		} 


		async list_all_trades() {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_trades where status!=\'matched\' order by transaction_id desc limit 100')); 
			if(err) {
				return console.error('list_all_trades_查询失败', err);
			}
			return result.rows;

		} 

		async list_matched_trades() {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_trades where status=\'matched\' order by created_at  desc')); 
			if(err) {
				return console.error('list_all_trades_查询失败', err);
			}
			return result.rows;

		} 





		async sort_trades(message,sort_by) {
			let sql = 'SELECT * FROM perpetual_trades where market_id=$1  and created_at>=$2 and  created_at<=$3 order by ' + sort_by + ' desc limit 30';		
			let [err,result] = await to(this.clientDB.query(sql,message)); 
			if(err) {
				return console.error('sort_trades_查询失败', err,message,sort_by);
			}
			return result.rows;

		} 


        async update_trades(update_info) {
			let [err,result] = await to(this.clientDB
				.query('UPDATE perpetual_trades SET (status,updated_at)=($1,$2) WHERE  transaction_id=$3',update_info)); 

			if(err) {
				return console.error('update_trades_查询失败', err,update_info);
			}
			//console.log('update_trades_成功',JSON.stringify(result),"info",update_info); 
			return result.rows;

        } 

		async launch_update_trades(update_info) {
			let [err,result] = await to(this.clientDB
				.query('UPDATE perpetual_trades SET (status,transaction_hash,updated_at)=($1,$2,$3) WHERE  transaction_id=$4',update_info)); 

			if(err) {
				return console.error('launch_update_trades_查询失败', err,update_info);
			}
			//console.log('launch_update_trades_成功',JSON.stringify(result),"info",update_info); 
			return result.rows;

        } 



		async get_laucher_trades() {
			//容错laucher过程中进程重启的情况
			let [err,result] = await to(this.clientDB.query('select t.*,s.right_id from (select * from perpetual_trades where status!=\'successful\' and transaction_hash is null)t left join (SELECT transaction_id as right_id  FROM perpetual_trades where status!=\'successful\'  and transaction_hash is null order by transaction_id  limit 1)s on t.transaction_id=s.right_id where s.right_id is not null')); 
			if(err) {
				return console.error('get_laucher_trades_查询失败', err);
			}

			console.log("gxygxy11111---",result.rows)
			return result.rows;

		} 

		async get_matched_trades() {
			let [err,result] = await to(this.clientDB.query('SELECT *  FROM perpetual_trades where status=\'matched\'')); 
			if(err) {
				return console.error('get_laucher_trades_查询失败', err);
			}
			return result.rows;

		} 

		//DELETE FROM  launch_logs WHERE item_id = 2880;;
		async delete_matched_trades() {
            let [err,result] = await to(this.clientDB.query('delete FROM perpetual_trades where status=\'matched\''));    
            if(err) {
                return console.error('get_laucher_trades_查询失败', err);
            }
            return result.rows;

        }



		/*
		*
		*users
		*
		*
		*/
	 	async update_user_token(update_info) {
			let [err,result] = await to(this.clientDB
				.query('UPDATE perpetual_users SET (pi,asim,btc,usdt,eth,mt,pi_valuation,asim_valuation,btc_valuation,usdt_valuation,eth_valuation,mt_valuation,updated_at)=($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) WHERE  address=$14',update_info)); 
			if(err) {
				return console.error('update_user_token_查询失败', err.update_info);
			}
		//	console.log('update_update_user_token_成功',JSON.stringify(result),"info",update_info); 
			return result.rows;

        } 


		async update_user_total(update_info) {
			let [err,result] = await to(this.clientDB
				.query('UPDATE perpetual_users SET (total_value_1day,total_value_2day,total_value_3day,total_value_4day,total_value_5day,total_value_6day,\
				total_value_7day,updated_at)=($1,total_value_1day,total_value_2day,total_value_3day,total_value_4day,total_value_5day,total_value_6day,$2) WHERE  address=$3',update_info)); 
			if(err) {
				return console.error('update_user_total_查询失败', err,update_info);
			}
		//	console.log('update_user_total_成功',JSON.stringify(result),update_info); 
			return result.rows;

        } 



		 async insert_users(address_info) {
			let [err,result] = await to(this.clientDB.query('insert into perpetual_users values($1)',address_info));
			if(err) {
				return console.error('insert_users_查询失败', err,address_info);
			}
		//	console.log('insert_users_成功',JSON.stringify(result),"info",address_info); 
			return JSON.stringify(result.rows);
        }


		async find_user(address) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_users  where address=$1',address)); 
			if(err) {
				return console.error('find_user_查询失败', err,address);
			}
			return result.rows;
		}

		async list_users() {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_users')); 
			if(err) {
				return console.error('list_users_查询失败', err);
			}
			return result.rows;
		}


		async my_converts(address) {
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_token_convert  where address=$1 order by created_at desc limit 30',address)); 
			if(err) {
				return console.error('list_borrows_查询失败', err,address);
			}
			return result.rows;

		}

		async my_converts2(filter_info) {
			console.log("11223344",filter_info);
			let [err,result] = await to(this.clientDB.query('SELECT * FROM perpetual_token_convert  where address=$1 order by created_at desc limit $3 offset $2',filter_info)); 
			if(err) {
				return console.error('list_borrows_查询失败', err,filter_info);
			}

			return result.rows;

		}

		
		 async insert_converts(info) {
			let [err,result] = await to(this.clientDB.query('insert into perpetual_coin_convert values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',info));
			if(err) {
				return console.error('insert_traders_查询失败', err);
			}
			//console.log('insert_borrows_成功',JSON.stringify(result),"info",borrow_info); 
			return JSON.stringify(result.rows);
        } 


		 async get_engine_info() {
			let [err,result] = await to(this.clientDB.query('select status,count(1) from perpetual_trades group by status'));
			if(err) {
				return console.error('insert_traders_查询失败', err);
			}
			return JSON.stringify(result.rows);
        } 
	

}
