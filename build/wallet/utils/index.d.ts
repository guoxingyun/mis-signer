export declare const sts2btc: (value: any) => any;
export declare const btc2sts: (value: any) => any;
export declare const getWordlistLanguage: (text: any) => "chinese_simplified" | "english";
export declare const getTimeInSection: (timestamp: any) => string;
export declare const checkContractAddress: (addr: any) => any;
export declare const validateMnemonic: (mnemonic: any) => boolean;
export declare function signature(pk: any, message: any): any;
export declare function getWalletAddr(): Promise<any>;
export declare function getWalletPubKey(): Promise<any>;
export declare function isArrayType(type: any): boolean;
export declare function callParamsConvert(type: any, value: any): any;
