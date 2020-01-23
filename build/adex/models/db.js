"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const await_to_js_1 = require("await-to-js");
const utils_1 = require("../api/utils");
const cfg_1 = require("../../cfg");
const BRIDGE_SQL = 'id,address,token_name,cast(amount as float8),side,master_txid,master_txid_status,child_txid,child_txid_status,fee_asset,fee_amount,updated_at,created_at';
class db {
    constructor() {
        const { Pool } = require('postgres-pool');
        const client = new Pool({
            host: cfg_1.default.pg_host,
            database: cfg_1.default.pg_database,
            user: cfg_1.default.pg_user,
            password: cfg_1.default.pg_password,
            port: cfg_1.default.pg_port,
        });
        this.clientDB = client;
        this.utils = new utils_1.default;
    }
    async insert_order(ordermessage) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into mist_orders values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', ordermessage));
        if (err) {
            return console.error(`insert_order_faied ${err},insert data= ${ordermessage}`);
        }
        const [err_tmp, result_tmp] = await await_to_js_1.default(this.clientDB.query('insert into mist_orders_tmp values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', ordermessage));
        if (err_tmp) {
            return console.error(`insert_order_tmp_faied ${err_tmp},insert data= ${ordermessage}`, result_tmp);
        }
        return JSON.stringify(result.rows);
    }
    async list_orders() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_orders_tmp order by create_at desc limit 30'));
        if (err) {
            return console.error('list_order failed', err);
        }
        return result.rows;
    }
    async my_orders(address) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_orders where trader_address=$1 order by updated_at desc limit 30', address));
        if (err) {
            return console.error('my_order_failed', err, address);
        }
        return result.rows;
    }
    async my_orders_length(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT count(1) FROM mist_orders where trader_address=$1 and status in ($2,$3)', info));
        if (err) {
            return console.error('my_order_length failed', err);
        }
        return result.rows[0].count;
    }
    async my_trades_length(address) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT count(1) FROM mist_trades where taker=$1 or maker=$1', address));
        if (err) {
            return console.error('my_trades_length failed', err, address);
        }
        return result.rows[0].count;
    }
    async my_bridge_length(address) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT count(1) FROM mist_bridge where address=$1', address));
        if (err) {
            return console.error('my_bridge_length failed ', err, address);
        }
        return result.rows[0].count;
    }
    async my_orders2(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_orders where trader_address=$1 and (status=$4 or status=$5)order by updated_at desc limit $3 offset $2', filter_info));
        if (err) {
            return console.error('my_orders2 failed ', err, filter_info);
        }
        return result.rows;
    }
    async find_order(order_id) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_orders where id=$1', order_id));
        if (err) {
            return console.error('find_order_failed', err, order_id);
        }
        return result.rows;
    }
    async filter_orders(filter) {
        let err;
        let result;
        if (filter[1] == 'sell') {
            [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_orders_tmp where price<=$1 and side=$2 and available_amount>0 and market_id=$3 order by price asc limit 100', filter));
        }
        else {
            [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_orders_tmp where price>=$1 and side=$2 and available_amount>0 and market_id=$3 order by price desc limit 100', filter));
        }
        if (err) {
            return console.error('filter_orders failed', err, filter);
        }
        return result.rows;
    }
    async update_orders(update_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_orders SET (available_amount,confirmed_amount,canceled_amount,\
                pending_amount,status,updated_at)=\
                (available_amount+$1,confirmed_amount+$2,canceled_amount+$3,pending_amount+$4,$5,$6) WHERE id=$7', update_info));
        if (err) {
            return console.error('update_orders failed', err, update_info);
        }
        const [err_tmp, result_tmp] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_orders_tmp SET (available_amount,confirmed_amount,canceled_amount,\
                pending_amount,status,updated_at)=\
                (available_amount+$1,confirmed_amount+$2,canceled_amount+$3,pending_amount+$4,$5,$6) WHERE id=$7', update_info));
        if (err_tmp) {
            return console.error('update_orders failed', err_tmp, result_tmp);
        }
        return result.rows;
    }
    async update_order_confirm(updatesInfo) {
        let query = 'set (confirmed_amount,pending_amount,updated_at)=(mist_orders.confirmed_amount+tmp.confirmed_amount,mist_orders.pending_amount+tmp.pending_amount,tmp.updated_at) from (values (';
        for (const index in updatesInfo) {
            if (updatesInfo[index]) {
                const tempValue = updatesInfo[index].info[0] + ','
                    + updatesInfo[index].info[1] + ',now()' + ',\'' + updatesInfo[index].info[3] + '\'; ';
                if (Number(index) < updatesInfo.length - 1) {
                    query = query + tempValue + '),(';
                }
                else {
                    query = query + tempValue + ')';
                }
            }
        }
        query += ') as tmp (confirmed_amount,pending_amount,updated_at,id) where mist_orders.id=tmp.id';
        const [err, result] = await await_to_js_1.default(this.clientDB.query('update mist_orders ' + query));
        if (err) {
            return console.error('update_order_confirm failed ', err, updatesInfo);
        }
        const [err_tmp, result_tmp] = await await_to_js_1.default(this.clientDB.query('update mist_orders_tmp as mist_orders ' + query));
        if (err_tmp) {
            return console.error('update_order_confirm failed ', err_tmp, result_tmp);
        }
        return result.rows;
    }
    async order_book(filter) {
        let err;
        let result;
        if (filter[0] === 'sell') {
            [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT price,sum(available_amount) as amount FROM mist_orders_tmp\
            where market_id=$2 and available_amount>0  and side=$1 group by price order by price asc limit 100', filter));
        }
        else {
            [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT price,sum(available_amount) as amount FROM mist_orders_tmp\
            where market_id=$2 and available_amount>0  and side=$1 group by price order by price desc limit 100', filter));
        }
        if (err) {
            return console.error('order_book failed', err, filter);
        }
        return result.rows;
    }
    async list_tokens(tradeid) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select * from mist_tokens'));
        if (err) {
            return console.error('list_tokens_failed', err, tradeid);
        }
        return result.rows;
    }
    async get_tokens(filter) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select * from mist_tokens where symbol=$1 or asim_assetid=$1 or address=$1', filter));
        if (err) {
            return console.error('get_tokens_failed', err, filter);
        }
        return result.rows;
    }
    async list_markets() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select * from mist_markets'));
        if (err) {
            return console.error('list_markets_failed', err);
        }
        return result.rows;
    }
    async get_market(marketID) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select * from mist_markets where id=$1', marketID));
        if (err) {
            return console.error('get_market_faied', err, marketID);
        }
        return result.rows;
    }
    async get_market_current_price(marketID) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select cast(price as float8) from mist_trades_tmp where (current_timestamp - created_at) < \'24 hours\' and market_id=$1 order by created_at desc limit 1', marketID));
        if (err) {
            return console.error('get_market_current_price_ failed', err, marketID);
        }
        if (result.rows.length == 0) {
            return [{ price: 0 }];
        }
        return result.rows;
    }
    async get_market_quotations(marketID) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select * from (select s.market_id,s.price,cast((s.price-t.price)/t.price as decimal(10,8)) ratio from (select * from mist_trades_tmp where market_id=$1 order by created_at desc limit 1)s left join (select price,market_id from mist_trades_tmp where market_id=$1 and (current_timestamp - created_at) < \'24 hours\' order by created_at asc  limit 1)t on s.market_id=t.market_id)k left join (select market_id,sum(amount) as volume from mist_trades_tmp where market_id=$1 and (current_timestamp - created_at) < \'24 hours\' group by market_id)m on k.market_id=m.market_id', marketID));
        if (err) {
            return console.error('get_market_quotations_ failed', err, marketID);
        }
        return result.rows;
    }
    async insert_trades(tradesInfo) {
        let query = 'values(';
        let tradesArr = [];
        for (const index in tradesInfo) {
            if (tradesInfo[index]) {
                let temp_value = '';
                for (let i = 1; i <= 15; i++) {
                    if (i < 15) {
                        temp_value += '$' + (i + 15 * Number(index)) + ',';
                    }
                    else {
                        temp_value += '$' + (i + 15 * Number(index));
                    }
                }
                if (Number(index) < tradesInfo.length - 1) {
                    query = query + temp_value + '),(';
                }
                else {
                    query = query + temp_value + ')';
                }
                tradesArr = tradesArr.concat(tradesInfo[index]);
            }
        }
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into mist_trades ' + query, tradesArr));
        if (err) {
            return console.error('insert_traders_ failed', err, tradesInfo);
        }
        const [err_tmp, result_tmp] = await await_to_js_1.default(this.clientDB.query('insert into mist_trades_tmp ' + query, tradesArr));
        if (err_tmp) {
            return console.error('insert_traders_tmp failed', err_tmp, result_tmp);
        }
        return JSON.stringify(result.rows);
    }
    async list_trades(marketID) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_trades_tmp where market_id=$1 order by created_at desc limit 30', marketID));
        if (err) {
            return console.error('list_trades_ failed', err, marketID);
        }
        return result.rows;
    }
    async my_trades(address) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_trades where taker=$1 or maker=$1 order by created_at desc limit 30', address));
        if (err) {
            return console.error('my_trades_ failed', err, address);
        }
        return result.rows;
    }
    async order_trades(order_id) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT price,amount FROM mist_trades where taker_order_id=$1 or maker_order_id=$1', order_id));
        if (err) {
            return console.error('my_trades_ failed', err);
        }
        return result.rows;
    }
    async my_trades2(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_trades where taker=$1 or maker=$1 order by created_at desc limit $3 offset $2', filter_info));
        if (err) {
            return console.error('my_trades_ failed', err, filter_info);
        }
        return result.rows;
    }
    async transactions_trades(id) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_trades_tmp where transaction_id=$1', id));
        if (err) {
            return console.error('transactions_trades_ failed', err, id);
        }
        return result.rows;
    }
    async list_all_trades() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_trades_tmp where status!=\'matched\' and (current_timestamp - created_at) < \'100 hours\' order by transaction_id desc limit 1'));
        if (err) {
            return console.error('list_all_trades_ failed', err);
        }
        return result.rows;
    }
    async list_matched_trades() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT count(1) FROM mist_trades_tmp where status=\'matched\''));
        if (err) {
            return console.error('list_all_trades_ failed', err);
        }
        return result.rows;
    }
    async sort_trades(message, sort_by) {
        const sql = 'SELECT * FROM mist_trades_tmp where market_id=$1  and created_at>=$2 and  created_at<=$3 order by ' + sort_by + ' desc limit 30';
        const [err, result] = await await_to_js_1.default(this.clientDB.query(sql, message));
        if (err) {
            return console.error('sort_trades_ failed', err, message, sort_by);
        }
        return result.rows;
    }
    async update_trades(update_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_trades SET (status,updated_at)=($1,$2) WHERE  transaction_id=$3', update_info));
        if (err) {
            return console.error('update_trades_ failed', err, update_info);
        }
        const [err_tmp, result_tmp] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_trades_tmp SET (status,updated_at)=($1,$2) WHERE  transaction_id=$3', update_info));
        if (err_tmp) {
            return console.error('update_trades_ failed', err_tmp, result_tmp);
        }
        return result.rows;
    }
    async launch_update_trades(update_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_trades SET (status,transaction_hash,updated_at)=($1,$2,$3) WHERE  transaction_id=$4', update_info));
        if (err) {
            return console.error('launch_update_trades_ failed', err, update_info);
        }
        const [err_tmp, result_tmp] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_trades_tmp SET (status,transaction_hash,updated_at)=($1,$2,$3) WHERE  transaction_id=$4', update_info));
        if (err_tmp) {
            return console.error('launch_update_trades_ failed', err_tmp, result_tmp);
        }
        return result.rows;
    }
    async get_laucher_trades() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query(' SELECT distinct(transaction_id)  FROM mist_trades_tmp where status in (\'pending\',\'matched\') and transaction_hash is null order by transaction_id  limit 1'));
        if (err) {
            return console.error('get_laucher_trades_ failed', err);
        }
        return result.rows;
    }
    async get_matched_trades() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT *  FROM mist_trades_tmp where status=\'matched\''));
        if (err) {
            return console.error('get_laucher_trades_ failed', err);
        }
        return result.rows;
    }
    async delete_matched_trades() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('delete FROM mist_trades where status=\'matched\''));
        if (err) {
            return console.error('get_laucher_trades_ failed', err);
        }
        return result.rows;
    }
    async insert_transactions(TXinfo) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into mist_transactions values($1,$2,$3,$4,$5,$6,$7)', TXinfo));
        if (err) {
            return console.error('insert_transactions_ failed', err, TXinfo);
        }
        return JSON.stringify(result.rows);
    }
    async list_transactions() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_transactions  order by id desc limit 30'));
        if (err) {
            return console.error('list_transactions_ failed', err);
        }
        return result.rows;
    }
    async get_pending_transactions() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_transactions where (current_timestamp - created_at) < \'24 hours\'  and status!=\'successful\' and transaction_hash is not null order by id  limit 1'));
        if (err) {
            return console.error('list_successful_transactions_ failed', err);
        }
        return result.rows;
    }
    async get_transaction(id) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_transactions where id=$1', id));
        if (err) {
            return console.error('get_transaction_ failed', err, id);
        }
        return result.rows;
    }
    async update_transactions(update_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_transactions SET (status,contract_status,updated_at)=($1,$2,$3) WHERE  id=$4', update_info));
        if (err) {
            return console.error('update_transactions_ failed', err, update_info);
        }
        return result.rows;
    }
    async list_borrows(address) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_borrows  where address=$1 order by updated_at desc limit 30', address));
        if (err) {
            return console.error('list_borrows_ failed', err, address);
        }
        return result.rows;
    }
    async my_borrows2(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_borrows  where address=$1 order by updated_at desc limit $3 offset $2', filter_info));
        if (err) {
            return console.error('list_borrows_ failed', err, filter_info);
        }
        return result.rows;
    }
    async find_borrow(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_borrows  where cdp_id=$1 and deposit_token_name=$2', info));
        if (err) {
            return console.error('find_borrow_ failed', err, info);
        }
        return result.rows;
    }
    async update_borrows(update_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_borrows SET (status,deposit_amount,repaid_amount,zhiya_rate,updated_at)=($1,deposit_amount+$2,repaid_amount+$3,(should_repaid_amount-$3)/((deposit_amount+$2)*deposit_price) ,$4) WHERE  deposit_token_name=$5 and  cdp_id=$6', update_info));
        if (err) {
            return console.error('update_order_ failed', err, update_info);
        }
        return result.rows;
    }
    async insert_borrows(borrow_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into mist_borrows values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)', borrow_info));
        if (err) {
            return console.error('insert_traders_ failed', err, borrow_info);
        }
        return JSON.stringify(result.rows);
    }
    async update_user_token(update_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_users SET (pi,asim,btc,usdt,eth,mt,pi_valuation,asim_valuation,btc_valuation,usdt_valuation,eth_valuation,mt_valuation,updated_at)=($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) WHERE  address=$14', update_info));
        if (err) {
            return console.error('update_user_token_ failed', err.update_info);
        }
        return result.rows;
    }
    async update_user_total(update_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB
            .query('UPDATE mist_users SET (total_value_1day,total_value_2day,total_value_3day,total_value_4day,total_value_5day,total_value_6day,\
				total_value_7day,updated_at)=($1,total_value_1day,total_value_2day,total_value_3day,total_value_4day,total_value_5day,total_value_6day,$2) WHERE  address=$3', update_info));
        if (err) {
            return console.error('update_user_total_ failed', err, update_info);
        }
        return result.rows;
    }
    async insert_users(address_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into mist_users values($1)', address_info));
        if (err) {
            return console.error('insert_users_ failed', err, address_info);
        }
        return JSON.stringify(result.rows);
    }
    async find_user(address) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_users  where address=$1', address));
        if (err) {
            return console.error('find_user_ failed', err, address);
        }
        return result.rows;
    }
    async list_users() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_users'));
        if (err) {
            return console.error('list_users_ failed', err);
        }
        return result.rows;
    }
    async find_cdp_token(token_name) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_cdp_info  where token_name=$1', token_name));
        if (err) {
            return console.error('find_cdp_token_ failed', err, token_name);
        }
        return result.rows;
    }
    async list_cdp() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_cdp_info'));
        if (err) {
            return console.error('list_cdp_ failed', err);
        }
        return result.rows;
    }
    async my_converts(address) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_token_convert  where address=$1 order by created_at desc limit 30', address));
        if (err) {
            return console.error('list_borrows_ failed', err, address);
        }
        return result.rows;
    }
    async my_converts2(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_token_convert  where address=$1 order by created_at desc limit $3 offset $2', filter_info));
        if (err) {
            return console.error('list_borrows_ failed', err, filter_info);
        }
        return result.rows;
    }
    async find_bridge(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query(`SELECT ${BRIDGE_SQL} FROM mist_bridge  where id=$1`, filter_info));
        if (err) {
            return console.error('find_bridge_ failed', err, filter_info);
        }
        return result.rows;
    }
    async my_bridge(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query(`SELECT ${BRIDGE_SQL} FROM mist_bridge  where address=$1 order by created_at desc limit $3 offset $2`, filter_info));
        if (err) {
            return console.error('list_borrows_ failed', err, filter_info);
        }
        return result.rows;
    }
    async filter_bridge(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('SELECT * FROM mist_bridge  where side=$1 and master_txid_status=$2 and child_txid_status=$3 order by created_at desc limit 1', filter_info));
        if (err) {
            return console.error('list_borrows_ failed', err, filter_info);
        }
        return result.rows;
    }
    async update_asset2coin_bridge(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('UPDATE mist_bridge SET (child_txid,child_txid_status,updated_at)=($1,$2,$3) WHERE id=$4', info));
        if (err) {
            return console.error('list_borrows_ failed', err, info);
        }
        return result.rows;
    }
    async update_asset2coin_decode(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('UPDATE mist_bridge SET (address,token_name,amount,master_txid_status,child_txid_status,fee_asset,fee_amount,updated_at)=($1,$2,$3,$4,$5,$6,$7,$8) WHERE id=$9', info));
        if (err) {
            return console.error('update_asset2coin_decode失败', err, info);
        }
        return result.rows;
    }
    async update_coin2asset_bridge(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('UPDATE mist_bridge SET (master_txid,master_txid_status,child_txid,child_txid_status,updated_at)=($1,$2,$3,$4,$5) WHERE id=$6', info));
        if (err) {
            return console.error('update_coin2asset_bridge', err, info);
        }
        return result.rows;
    }
    async update_coin2asset_failed(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('UPDATE mist_bridge SET (master_txid,master_txid_status,updated_at)=($1,$2,$3) WHERE id=$4', info));
        if (err) {
            return console.error('update_coin2asset_bridge', err, info);
        }
        return result.rows;
    }
    async my_bridge_v3(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query(`SELECT ${BRIDGE_SQL} FROM mist_bridge  where address=$1 and token_name=$2 order by created_at desc limit $4 offset $3`, filter_info));
        if (err) {
            return console.error('list_borrows_ failed', err, filter_info);
        }
        return result.rows;
    }
    async insert_converts(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into mist_token_convert values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', info));
        if (err) {
            return console.error('insert_traders_ failed', err);
        }
        return JSON.stringify(result.rows);
    }
    async insert_bridge(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into mist_bridge values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', info));
        if (err) {
            return console.error('insert_mist_bridge_ failed', err);
        }
        return JSON.stringify(result.rows);
    }
    async get_engine_info() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select status,count(1) from mist_trades_tmp group by status'));
        if (err) {
            return console.error('insert_traders_ failed', err);
        }
        return JSON.stringify(result.rows);
    }
    async get_freeze_amount(filter_info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select market_id,side,sum(pending_amount+available_amount) as base_amount,sum((pending_amount+available_amount) * price) as quote_amount from mist_orders_tmp where trader_address=$1 group by market_id,side having (position($2 in market_id)=1 and side=\'sell\') or (position($2 in market_id)>1 and side=\'buy\')', filter_info));
        if (err) {
            return console.error('get_freeze_amount failed', err, filter_info);
        }
        return result.rows;
    }
    async list_assets_info() {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('select s.*,m.circulation_amount as old_circulation_amount   from (select * from asim_assets_info order by created_at desc limit 5)s left join (select * from asim_assets_info where created_at - current_timestamp < \'24 minutes\' order by created_at limit 5)m on s.asset_id=m.asset_id'));
        if (err) {
            return console.error('errlist_assets_info_ failed', err);
        }
        return JSON.stringify(result.rows);
    }
    async insert_assets_info(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('insert into asim_assets_info  values($1,$2,$3,$4,$5,$6,$7,$8)', info));
        if (err) {
            return console.error('insert__assets_info_ failed', err, info);
        }
        return JSON.stringify(result.rows);
    }
    async update_assets_total(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('UPDATE asim_assets_info SET (total,updated_at)=($1,$2) WHERE asset_name=$3', info));
        if (err) {
            return console.error('update_asset_info', err, info);
        }
        return result.rows;
    }
    async update_assets_yesterday_total(info) {
        const [err, result] = await await_to_js_1.default(this.clientDB.query('UPDATE asim_assets_info SET (yesterday_total,updated_at)=($1,$2) WHERE asset_name=$3', info));
        if (err) {
            return console.error('update_asset_info', err, info);
        }
        return result.rows;
    }
}
exports.default = db;
//# sourceMappingURL=db.js.map