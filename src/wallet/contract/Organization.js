import helper from '../lib/txHelper'
import { chain } from '../api/chain'
import { TranService } from "../service/transaction";
import { CONSTANT } from "../constant";
import { btc2sts, isArrayType, callParamsConvert } from "../utils";

export default class Organization {
        abiStr = '[{"constant":true,"inputs":[{"name":"_address","type":"address"}],"name":"getAddressRolesMap","outputs":[{"name":"","type":"bytes32[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"name","type":"string"},{"name":"symbol","type":"string"},{"name":"desc","type":"string"}],"name":"issueNewAsset","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getTemplateInfo","outputs":[{"name":"","type":"uint16"},{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_role","type":"string"},{"name":"_opMode","type":"uint8"}],"name":"configureFunctionRoleSuper","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"assetIndex","type":"uint32"}],"name":"getAssetInfo","outputs":[{"name":"","type":"bool"},{"name":"","type":"string"},{"name":"","type":"string"},{"name":"","type":"string"},{"name":"","type":"uint32"},{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_address","type":"address"},{"name":"_opMode","type":"uint8"}],"name":"configureFunctionAddressAdvanced","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_address","type":"address"},{"name":"_opMode","type":"uint8"}],"name":"configureFunctionAddressSuper","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_function","type":"string"},{"name":"_role","type":"string"},{"name":"_opMode","type":"uint8"}],"name":"configureFunctionRole","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_address","type":"address"},{"name":"_role","type":"string"},{"name":"_opMode","type":"uint8"}],"name":"configureAddressRole","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"assetIndex","type":"uint32"},{"name":"transferAddress","type":"address"}],"name":"canTransferAsset","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"registerMe","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_caller","type":"address"},{"name":"_functionStr","type":"string"}],"name":"canPerform","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_category","type":"uint16"},{"name":"_templateName","type":"string"}],"name":"initTemplate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_function","type":"string"},{"name":"_address","type":"address"},{"name":"_opMode","type":"uint8"}],"name":"configureFunctionAddress","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_role","type":"string"},{"name":"_opMode","type":"uint8"}],"name":"configureFunctionRoleAdvanced","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"FUNCTION_HASH_SAMPLE","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"index","type":"uint32"}],"name":"issueMoreAsset","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"assetIndex","type":"uint32"}],"name":"getCreateAndMintHistory","outputs":[{"name":"","type":"bool"},{"name":"","type":"string"},{"name":"","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"asset","type":"uint256"},{"name":"amount","type":"uint256"}],"name":"transferAsset","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"ROLE_SAMPLE","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"organizationName","type":"string"},{"name":"_members","type":"address[]"}],"payable":false,"stateMutability":"nonpayable","type":"constructor","name":"SimpleOrganization"},{"anonymous":false,"inputs":[{"indexed":false,"name":"invitee","type":"address"}],"name":"invite","type":"event"}]';


    fee = 0.05
    gasLimit = 10000000

    constructor(address) {
        this.address = address;
    }

    /**
     * unlock once
     * @param {*} wallet 
     * @param {*} password 
     */
    unlock(wallet, password) {
        this.wallet = wallet
        this.password = password
    }
    /**
     * Call Contract Function with abi Info
     * 除了充值合约，主币的amount应该都是0，扣fee会自动计算。
     * 
     * @param {*} abiInfo 
     * @param {*} wallet 
     */
    async callContract(abiInfo) {
        let params = {
            to: this.address,
            amount: 0,
            assetId: CONSTANT.DEFAULT_ASSET,
            data: this.getHexData(abiInfo)
        };

        console.log("params.data:",params.data)

        if (abiInfo.stateMutability == 'view' || abiInfo.stateMutability == 'pure') {
            return chain.callreadonlyfunction([this.address, this.address, params.data, abiInfo.name, this.abiStr])
        } else {
            params.from = await this.wallet.getAddress()
            params.type = CONSTANT.CONTRACT_TYPE.CALL
            return this.executeContract(params)
        }
    }

    /**
     * Execute Contract Function，Wallet需要在执行Contract前更新UTXO，确保缓存正确可以执行成功
     * await wallet.queryAllBalance()
     * 
     * @param {*} params 
     */
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

        try {
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

    /**
     * return balance of address
     * @param {*} address 
     */
    async TemplateInfo(address) {
        

            console.log("gxy---address=",address);
        let abiInfo ={"constant":true,"inputs":[],"name":"getTemplateInfo","outputs":[{"name":"","type":"uint16"},{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"};
        return this.callContract(abiInfo);
    }


    async issueMoreAsset(index) {
       
      let abiInfo =  {"constant":false,"inputs":[{"name":"index","type":"uint32","value": 200000005}],"name":"issueMoreAsset","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"};
        
      return this.callContract(abiInfo);
    }
    /**
     * Generate ABI Hex Data
     * @param {*} abiInfo 
     */
    getHexData(abiInfo) {
        if (!abiInfo) return
        if (!abiInfo.inputs) return

        let funcArgs = []

        abiInfo.inputs.forEach(i => {
            if (isArrayType(i.type)) {
                let arr = JSON.parse(i.value);
                let type = i.type.replace('[]', '');
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
        } catch (e) {
            console.log("getHexData encodeFunctionId Error:", e, abiInfo);
            return;
        }

        try {
            paramsHash = helper.encodeParams(abiInfo, funcArgs).toString('hex');
        } catch (e) {
            console.log("getHexData encodeParams Error", e, abiInfo, funcArgs);
            return;
        }

        let data = functionHash.replace('0x', '') + paramsHash.replace('0x', '');
        return data;
    }


}
