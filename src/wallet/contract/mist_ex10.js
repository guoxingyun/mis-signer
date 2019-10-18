

import helper from '../lib/txHelper'
import { chain } from '../api/chain'
import { TranService } from "../service/transaction";
import { CONSTANT } from "../constant";
import { btc2sts, isArrayType, callParamsConvert,signature,getWalletPubKey} from "../utils";
const bitcore_lib_1 = require("bitcore-lib");
const ECDSA = bitcore_lib_1.crypto.ECDSA;

export default class Token {
 abiStr='[{"constant":true,"inputs":[{"components":[{"name":"adr","type":"address"},{"name":"age","type":"uint256"},{"components":[{"name":"naem","type":"string"}],"name":"mg","type":"tuple"}],"name":"ab","type":"tuple"}],"name":"sdfs","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"components":[{"name":"taker","type":"address"},{"name":"maker","type":"address"},{"name":"baseToken","type":"address"},{"name":"quoteToken","type":"address"},{"name":"relayer","type":"address"},{"name":"baseTokenAmount","type":"uint256"},{"name":"quoteTokenAmount","type":"uint256"},{"name":"takerSide","type":"string"}],"name":"_order","type":"tuple"}],"name":"getorderhash","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"name":"taker","type":"address"},{"name":"maker","type":"address"},{"name":"baseTokenAmount","type":"uint256"},{"name":"quoteTokenAmount","type":"uint256"},{"name":"takerSide","type":"string"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"},{"name":"v","type":"uint8"}],"name":"TradeParams","type":"tuple[]"},{"components":[{"name":"baseToken","type":"address"},{"name":"quoteToken","type":"address"},{"name":"relayer","type":"address"}],"name":"orderAddressSet","type":"tuple"}],"name":"matchOrder","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getTemplateInfo","outputs":[{"name":"","type":"uint16"},{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"components":[{"name":"taker","type":"address"},{"name":"maker","type":"address"},{"name":"baseToken","type":"address"},{"name":"quoteToken","type":"address"},{"name":"relayer","type":"address"},{"name":"baseTokenAmount","type":"uint256"},{"name":"quoteTokenAmount","type":"uint256"},{"name":"takerSide","type":"string"}],"name":"_order","type":"tuple"}],"name":"hashordermsg","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_hashmsg","type":"bytes32"}],"name":"hashmsg","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"EIP712_ORDERTYPE","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_category","type":"uint16"},{"name":"_templateName","type":"string"}],"name":"initTemplate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_hash","type":"bytes32"},{"components":[{"name":"taker","type":"address"},{"name":"maker","type":"address"},{"name":"baseTokenAmount","type":"uint256"},{"name":"quoteTokenAmount","type":"uint256"},{"name":"takerSide","type":"string"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"},{"name":"v","type":"uint8"}],"name":"_trade","type":"tuple"},{"components":[{"name":"baseToken","type":"address"},{"name":"quoteToken","type":"address"},{"name":"relayer","type":"address"}],"name":"_order","type":"tuple"}],"name":"isValidSignature","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor","name":"MistExchange"},{"anonymous":false,"inputs":[{"indexed":false,"name":"ads","type":"address"}],"name":"isValid","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"bs","type":"bytes32"}],"name":"orderhashmsg","type":"event"}]' 
 fee = 0.1
 gasLimit = 30000000

 constructor(address) {
    this.address = address;
}

unlock(wallet, password) {
    this.wallet = wallet
    this.password = password
}

async callContract(abiInfo) {
    let params = {
        to: this.address,
        amount: 0,
        assetId: CONSTANT.DEFAULT_ASSET,
        data: this.getHexData(abiInfo)
      };
      console.log('params.data',params.data)
    if (abiInfo.stateMutability == 'view' || abiInfo.stateMutability == 'pure') {
        return chain.callreadonlyfunction([this.address, this.address, params.data, abiInfo.name, this.abiStr])
    } else {
        params.from = await this.wallet.getAddress()
        params.type = CONSTANT.CONTRACT_TYPE.CALL
        return this.executeContract(params)
    }
}

async executeContract(params) {
    let wallet = this.wallet;
    let password = this.password;

    let { ins, changeOut } = await TranService.chooseUTXO(
        wallet.walletId,
        params.amount,
        params.assetId,
        params.from,
        this.fee
    );

    let outs = [{
        amount: btc2sts(parseFloat(params.amount)),
        assets: params.assetId,
        address: params.to,
        data: params.data || "",
        contractType: params.type || ""
    }];

    if (changeOut && changeOut.length) {
        outs = outs.concat(changeOut);
    }

    let keys = await wallet.getPrivateKeys(
        CONSTANT.DEFAULT_COIN.coinType,
        ins,
        password
    );
    console.log("privatekeuy===",keys)

    try {
        console.log("Input",ins)
        let rawtx = TranService.generateRawTx(ins, outs, keys, this.gasLimit);

        console.log("RAWTX:",rawtx)

        if (!rawtx) {
            console.log("executeContract Raw TX Error")
            return;
        }

        console.log("executeContract Success:", params, ins, outs);
        return chain.sendrawtransaction([rawtx]);
    } catch (e) {
        console.log("executeContract TX Error", e)
    }
}


getHexData(abiInfo) {
    if (!abiInfo) return
    if (!abiInfo.inputs) return

    let funcArgs = []
    abiInfo.inputs.forEach(i => {
        if (isArrayType(i.type)) {
            let arr = (i.value);
            let type =  i.type.replace('[]', '');
            let result = []
            arr.forEach(a => {
                result.push(callParamsConvert(type, a))
            });
            funcArgs.push(result);
        } else {
            funcArgs.push(callParamsConvert(i.type, i.value))
        }
    })

    let functionHash, paramsHash = ""
  
    try {
        functionHash = helper.encodeFunctionId(abiInfo);
        console.log('functionHash',functionHash)
    } catch (e) {
        console.log("getHexData encodeFunctionId Error:", e, abiInfo);
        return;
    }

    try {
         console.log("funcArgs",funcArgs)
        paramsHash = helper.encodeParams(abiInfo, funcArgs).toString('hex');
    } catch (e) {
        console.log("getHexData encodeParams Error", e, abiInfo, funcArgs);
        return;
    }

    let data = functionHash.replace('0x', '') + paramsHash.replace('0x', '');
    return data;
}

   
    async batch(){
         return this.callContract(abiInfo);
    }






    async orderhash(trade){
            let abiInfo=
            {"constant":false,
            "inputs":[{"components":
            [{"name":"taker","type":"address"},
            {"name":"maker","type":"address"},
            {"name":"baseToken","type":"address"},
            {"name":"quoteToken","type":"address"},
            {"name":"relayer","type":"address"},
            {"name":"baseTokenAmount","type":"uint256"},
            {"name":"quoteTokenAmount","type":"uint256"},
            {"name":"takerSide","type":"string"}],
          //  "name":"_order","type":"tuple","value":['0x6632bd37c1331b34359920f1eaa18a38ba9ff203e9','0x66b7637198aee4fffa103fc0082e7a093f81e05a64','0x6376141c4fa5b11841f7dc186d6a9014a11efcbae6',
          //  '0x63b98f4bf0360c91fec1668aafdc552d3c725f66bf','0x6611f5fa2927e607d3452753d3a41e24a23e0b947f',10,10,'buy']}],
		  	"name":"_order","type":"tuple","value":trade}],
            "name":"hashordermsg",
            "outputs":[{"name":"","type":"bytes32"}],
            "payable":false,
            "stateMutability":"nonpayable",
            "type":"function"}

         return this.callContract(abiInfo);
     }




   async matchorder(trades_info,order_address_set,trades_hash){
    //    //1.签名：
      //    var privKey = '0190aa58022d3879bac447427723ce7f1df4cf89f1048d32e377cd893be5a325'
	  //relayer_pri_key
	  var privKey =  'd2dd57d8969770fad230bf34cacc5ca60e2dc7e406f8f99ced0f59ccf56a19c2';
		  for(index in trades_hash){
          var hashbuf=Buffer.alloc(32,trades_hash[index],'hex')
          var sig = ECDSA.sign(hashbuf, new bitcore_lib_1.PrivateKey(privKey) )

         let r = ECDSA.sign(hashbuf,new bitcore_lib_1.PrivateKey(privKey)).r.toString('hex')
         let s = ECDSA.sign(hashbuf,new bitcore_lib_1.PrivateKey(privKey)).s.toString('hex')
		 console.log("indexxxxxxxxx",dex)
		 trades_info[index].push(r,s,27);
        }
//		asim-api
        let abiInfo=
        {"constant":false,
        "inputs":[{"components":
        [{"name":"taker","type":"address"},
        {"name":"maker","type":"address"},
        {"name":"baseTokenAmount","type":"uint256"},
        {"name":"quoteTokenAmount","type":"uint256"},
        {"name":"takerSide","type":"string"},
        {"name":"r","type":"bytes32"},
        {"name":"s","type":"bytes32"},
        {"name":"v","type":"uint8"}],
    //    "name":"TradeParams","type":"tuple[]","value":[['0x6632bd37c1331b34359920f1eaa18a38ba9ff203e9','0x66b7637198aee4fffa103fc0082e7a093f81e05a64',10,10,
      //  'buy','0x3731597097df23bc05b8e938ebc8a606e47b7c13987d6d9a04070eb049464685','0x653a585c541dcbe2055049f12a9e3a7b58f20fb1b3de702a48855b55d31f2bd0',27]]},
    	  "name":"TradeParams","type":"tuple[]","value":trades_info},
        {"components":
        [{"name":"baseToken","type":"address"},
        {"name":"quoteToken","type":"address"},
        {"name":"relayer","type":"address"}],
     //   "name":"orderAddressSet","type":"tuple","value":['0x6376141c4fa5b11841f7dc186d6a9014a11efcbae6','0x63b98f4bf0360c91fec1668aafdc552d3c725f66bf','0x6611f5fa2927e607d3452753d3a41e24a23e0b947f']}],
       "name":"orderAddressSet","type":"tuple","value":order_address_set}],
        "name":"matchOrder",
        "outputs":[],
        "payable":false,
        "stateMutability":"nonpayable",
        "type":"function"}
	  return this.callContract(abiInfo);
    }
    
   

}