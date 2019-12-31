import to from 'await-to-js'
import TokenTest from '../wallet/contract/TokenTest'
import walletHelper from '../wallet/lib/walletHelper'
import mist_ex from '../wallet/contract/mist_ex'
import mist_ex10 from '../wallet/contract/mist_ex10'
import utils2 from '../adex/utils'
import {restore_order} from '../adex/order'
import NP from 'number-precision'

var date = require("silly-datetime");
import mist_config from '../cfg';


let walletInst;
async function getTestInst() {
	// 暂时每次都重新创建实例，效率低点但是应该更稳定。
	// if (walletInst) return walletInst;
	//relayer words
//	walletInst = await walletHelper.testWallet('ivory local this tooth occur glide wild wild few popular science horror', '111111')
//order hash有专门另外个账户打包
	walletInst = await walletHelper.testWallet(mist_config.order_hash_word, '111111')
	return walletInst
}


export default class engine {
	db;
	datas;
	constructor(client) {
		this.db = client;
		this.utils = new utils2;
	}


	async match(message) {
		let side = "buy";
		if (message.side == "buy") {
			side = "sell"
		}

		let filter = [message.price, side, message.market_id];

		let result = await this.db.filter_orders(filter);

		let match_orders = [];
		let amount = 0;
		//find and retunr。all orders。which's price below this order
		//下单量大于匹配的总额或者或者下单量小于匹配的总额，全部成交 
		console.log("gxy44444555----length", result.length);
		for (var i = 0; i < result.length; i++) {

			//返回的字面量用+处理成数值
			result[i].amount = +result[i].amount;
			result[i].available_amount = +result[i].available_amount;
			match_orders.push(result[i]);
			amount += result[i].available_amount;
			if (amount >= message.amount) {

				break;
			}

		}

		return match_orders;
	}

	async make_trades(find_orders, my_order) {
		//       var create_time = date.format(new Date(),'YYYY-MM-DD HH:mm:ss'); 
		let create_time = this.utils.get_current_time();
		let trade_arr = [];
		let amount = 0;
		for (var item = 0; item < find_orders.length; item++) {

			//partial_filled,pending,full_filled,默认吃单有剩余，挂单吃完
			let maker_status = 'full_filled';

			//最低价格的一单最后成交，成交数量按照吃单剩下的额度成交,并且更新最后一个order的可用余额fixme__gxy
			 amount = NP.plus(amount,find_orders[item].available_amount);

			//吃单全部成交,挂单有剩余的场景,
			if (item == find_orders.length - 1 && amount > my_order.amount) {


				console.log("gxyyy--available_amount-2222888889999-", find_orders[item].available_amount, my_order.amount,"amount=",amount);
				//find_orders[item].available_amount -= (amount - my_order.amount);
				let overflow_amount = NP.minus(amount, my_order.amount)
				find_orders[item].available_amount = NP.minus(find_orders[item].available_amount,overflow_amount)
				maker_status = 'partial_filled';
				console.log("gxyyy--available_amount-222288888-", find_orders[item].available_amount, my_order.amount,"amount=",amount);
			}

			console.log("gxyyy--available_amount-333-", find_orders[item].available_amount, my_order.amount);
			let trade = {
				id: null,
				trade_hash:null,
				transaction_id: null,
				transaction_hash: null,
				status: "matched", //匹配完成事matched，打包带确认pending，确认ok为successful，失败为failed
				market_id: my_order.market_id,
				maker: find_orders[item].trader_address,
				taker: my_order.trader_address,
				price: find_orders[item].price,
				amount: find_orders[item].available_amount,
				taker_side: my_order.side,
				maker_order_id: find_orders[item].id,
				taker_order_id: my_order.id,
				created_at: create_time,
				updated_at: create_time
			};

			let trade_id = this.utils.get_hash(trade);
			trade.id = trade_id;
			//插入trades表_  fixme__gxy        
			trade_arr.push(trade);
			//匹配订单后，同时更新taker和maker的order信息,先不做错误处理,买单和卖单的计算逻辑是相同的,只需要更新available和pending
			//此更新逻辑适用于全部成交和部分成交的两种情况
			//available_amount,confirmed_amount,canceled_amount,pending_amount


			let update_maker_orders_info = [-find_orders[item].available_amount, 0, 0, find_orders[item].available_amount, maker_status, create_time, find_orders[item].id];
			//	  let update_taker_orders_info = [-find_orders[item].available_amount,0,0,find_orders[item].available_amount,taker_status,create_time,my_order.id];

			await this.db.update_orders(update_maker_orders_info);
			//	  await this.db.update_orders(update_taker_orders_info);
			//  await this.db.insert_trades(this.utils.arr_values(trade));

		}

		return trade_arr;

	}

	async call_asimov(trades) {
		console.log("dex_match_order----gxy---22", trades);
		let token_address = await this.db.get_market([trades[0].market_id]);

		let transactions = await this.db.list_all_trades();
		let matched_trades = await this.db.list_matched_trades();
		//累计没超过100+1,粒度小，relayer高频，粒度大relayer低频
		//新加坡服务器访问慢，先调大
		let add_queue_num  = Math.floor(matched_trades.length / 300 ) + 1;

		let transaction_id = transactions.length == 0 ?  0 : transactions[0].transaction_id + add_queue_num;

		console.log("index,transaction_id,=", add_queue_num,transaction_id);


		//为了保证relayer的轮番顺序打包，这里和transaction_id关联
		let index = transaction_id % 3;
		console.log("gxyrelayers-engine-1",transaction_id,index,mist_config.relayers[index]);
		let order_address_set = [token_address[0].base_token_address, token_address[0].quote_token_address, mist_config.relayers[index].address];



	
		let trades_arr= [];
		for (var i in trades) {

			let trade_info ={
			taker: trades[i].taker,
			maker: trades[i].maker,
			baseToken: order_address_set[0],
			quoteToken: order_address_set[1],
			relayer: order_address_set[2],
			baseTokenAmount: NP.times(trades[i].amount, 100000000), //    uint256 baseTokenAmount;
			quoteTokenAmount: NP.times(trades[i].amount, trades[i].price,100000000), // quoteTokenAmount;
			takerSide:	trades[i].taker_side
			};

			trades[i].transaction_id = transaction_id;
			trades[i].trade_hash = await this.utils.orderhashbytes(trade_info);

			trades_arr.push(this.utils.arr_values(trades[i]))
		}

		console.log("-call_asimov_result33333----------",transaction_id + 'gxyyyyy',mist_config.relayers[index].address,index)

		await this.db.insert_trades(trades_arr);

	}


}