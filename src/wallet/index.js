import { Router } from 'express'
import { chain } from './api/chain'
import { walletRPC } from './api/wallet'
import walletHelper from './lib/walletHelper'
import to from 'await-to-js'
import TokenTest from './contract/TokenTest'
import OrganizationTest from './contract/OrganizationTest'
import AssetTest from './asset/AssetTest'
<<<<<<< Updated upstream
=======
import StorageTest from './contract/StorageTest'
import myTokena from './contract/myToken'
>>>>>>> Stashed changes

let walletInst;
async function getTestInst(){
	if( walletInst ) return walletInst;
	walletInst = await walletHelper.testWallet('ivory local this tooth occur glide wild wild few popular science horror','111111')
	return walletInst
}

export default ({ config, db }) => {
	let wallet = Router();
	let tokenTest = new TokenTest()
	let organizationTest = new OrganizationTest()
	let assetTest = new AssetTest()
<<<<<<< Updated upstream


=======
	let storageTest = new StorageTest()
	let myToken = new myTokena()
>>>>>>> Stashed changes

	wallet.get('/', async (req, res) => {
		walletInst = await getTestInst();
		let address = await walletInst.getAddress()
		res.json({ wallet:address })
	});

<<<<<<< Updated upstream
=======
	wallet.get('/storage',async (req, res) => {
		walletInst = await getTestInst();
		let [err,result] = await to(storageTest.testInsert(walletInst))
		console.log(result,err);

		res.json({ result:result,err:err });
	});

    wallet.get('/mybalance/:address',async (req, res) => {

        let address = "sss";
		let [err,result] = await to(myToken.myBalance(address))
		console.log(result,err);

		res.json({ result:result,err:err });
	});

	wallet.get('/myAprove',async (req, res) => {

		walletInst = await getTestInst();
		let [err,result] = await to(tokenTest.testTransfer(walletInst))
		console.log(result,err);

		if( !err ){
			// 先简单处理，Execute 前更新UTXO
			await walletInst.queryAllBalance()
		}

		res.json({ result:result,err:err });
	});




>>>>>>> Stashed changes
	wallet.get('/balance',async (req, res) => {

		let [err,result] = await to(tokenTest.testBalanceOf())

		console.log(result,err);

		res.json({ result:result,err:err });
	});

	wallet.get('/transfer',async (req, res) => {

		walletInst = await getTestInst();
		let [err,result] = await to(tokenTest.testTransfer(walletInst))
		console.log(result,err);

		if( !err ){
			// 先简单处理，Execute 前更新UTXO
			await walletInst.queryAllBalance()
		}

		res.json({ result:result,err:err });
	});

	wallet.get('/approve',async (req, res) => {

		walletInst = await getTestInst();
		let [err,result] = await to(tokenTest.testApprove(walletInst))
		console.log(result,err);

		res.json({ result:result,err:err });
	});

	/**
	 * Assets Test
	 */

	wallet.get('/assetTransfer',async (req, res) => {

		walletInst = await getTestInst();
		let [err,result] = await to(assetTest.testTransfer(walletInst))
		console.log(result,err);

		if( !err ){
			// 先简单处理，Execute 前更新UTXO
			await walletInst.queryAllBalance()
		}

		res.json({ result:result,err:err });
	});

	/**
	 * curl -X POST --data '{"id":1, "jsonrpc":"2.0","method":"asimov_searchRawTransactions",
	 * "params":["0x666e55294d0ee2b7306b9a765b576df9c8ed73a877",true,0,1,false,false,[]]}' 
	 * -H "Content-type: application/json" http://localhost:8545/
	 * 
	 * Parameters
	 * -transaction associated address
	 * -get detail or not
	 * -transaction offset
	 * -number of transactions
	 * -get last output or not
	 * -reverse or not
	 * -addresses not included
	 * 
	 * Returns
	 * -information of raw transaction
	 */
	wallet.get('/tx',async (req, res) => {
		let address
		if( req.query.address ){
			address = req.query.address
		} else {
			walletInst = await getTestInst();
			address = await walletInst.getAddress()
		}
		let num = 3
		let reverse = true

		let [err,result] = await to(chain.searchrawtransactions([address,true,0,num,false,reverse,[]]))

		res.json({result,err });
	});

	wallet.get('/rawtx',async (req, res) => {
		let txid = req.query.txid

		let [err,result] = await to(chain.getrawtransaction([txid,true,true]))

		res.json({result,err });
	});

	/**
	 * asimov_getUtxoByAddress
	 * Returns UTXO of given address.
	 * 
	 * Parameters
	 * address
	 * asset (optional, "")
	 * Returns
	 * UTXO information
	 */
	wallet.get('/utxo',async (req, res) => {
		let address
		if( req.query.address ){
			address = req.query.address
		} else {
			walletInst = await getTestInst();
			address = await walletInst.getAddress()
		}

		let [err,result] = await to(walletRPC.getutxobyaddress([[address],""]))

		res.json({result,err });
	});

    wallet.get('/getTemplateInfo',async (req, res) => {

		let [err,result] = await to(organizationTest.testGetTemplateInfo());
		console.log(result,err);

		res.json({ result:result,err:err });
	});

    wallet.get('/issueMoreAsset/:index',async (req, res) => {
       let index = '000000000000000200000005' 
       walletInst = await getTestInst();
		let [err,result] = await to(organizationTest.testissueMoreAsset(index,walletInst));
		console.log(result,err);

		res.json({ result:result,err:err });
	});

	return wallet;
}
