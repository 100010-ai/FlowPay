export type BankDirectoryEntry={
  id:string
  name:string
  bic:string|null
  website:string|null
  logoUrl:string|null
  source:'wikidata'|'curated'
}

const curated:Record<string,Array<Omit<BankDirectoryEntry,'id'|'source'|'logoUrl'|'bic'>&{bic?:string|null}>>={
  RU:[{name:'Sberbank',website:'https://www.sberbank.com'},{name:'VTB Bank',website:'https://www.vtb.com'},{name:'Alfa-Bank',website:'https://alfabank.ru'},{name:'T-Bank',website:'https://www.tbank.ru'}],
  FR:[{name:'BNP Paribas',website:'https://group.bnpparibas'},{name:'Crédit Agricole',website:'https://www.credit-agricole.com'},{name:'Société Générale',website:'https://www.societegenerale.com'},{name:'Groupe BPCE',website:'https://www.groupebpce.com'}],
  DE:[{name:'Deutsche Bank',website:'https://www.db.com'},{name:'Commerzbank',website:'https://www.commerzbank.com'},{name:'DZ BANK',website:'https://www.dzbank.com'},{name:'KfW',website:'https://www.kfw.de'}],
  GB:[{name:'HSBC UK',website:'https://www.hsbc.co.uk'},{name:'Barclays',website:'https://www.barclays.co.uk'},{name:'Lloyds Bank',website:'https://www.lloydsbank.com'},{name:'NatWest',website:'https://www.natwest.com'}],
  US:[{name:'JPMorgan Chase Bank',website:'https://www.jpmorganchase.com'},{name:'Bank of America',website:'https://www.bankofamerica.com'},{name:'Citibank',website:'https://www.citi.com'},{name:'Wells Fargo Bank',website:'https://www.wellsfargo.com'}],
  ES:[{name:'Banco Santander',website:'https://www.santander.com'},{name:'BBVA',website:'https://www.bbva.com'},{name:'CaixaBank',website:'https://www.caixabank.com'},{name:'Banco Sabadell',website:'https://www.bancsabadell.com'}],
  IT:[{name:'Intesa Sanpaolo',website:'https://group.intesasanpaolo.com'},{name:'UniCredit',website:'https://www.unicreditgroup.eu'},{name:'Banco BPM',website:'https://gruppo.bancobpm.it'},{name:'BPER Banca',website:'https://www.bper.it'}],
  NL:[{name:'ING Bank',website:'https://www.ing.com'},{name:'ABN AMRO',website:'https://www.abnamro.com'},{name:'Rabobank',website:'https://www.rabobank.com'},{name:'de Volksbank',website:'https://www.devolksbank.nl'}],
  CH:[{name:'UBS Switzerland',website:'https://www.ubs.com'},{name:'Zürcher Kantonalbank',website:'https://www.zkb.ch'},{name:'Raiffeisen Schweiz',website:'https://www.raiffeisen.ch'},{name:'PostFinance',website:'https://www.postfinance.ch'}],
  AT:[{name:'Erste Bank',website:'https://www.sparkasse.at/erstebank'},{name:'Raiffeisen Bank International',website:'https://www.rbinternational.com'},{name:'BAWAG',website:'https://www.bawag.at'},{name:'Bank Austria',website:'https://www.bankaustria.at'}],
  PL:[{name:'PKO Bank Polski',website:'https://www.pkobp.pl'},{name:'Bank Pekao',website:'https://www.pekao.com.pl'},{name:'Santander Bank Polska',website:'https://www.santander.pl'},{name:'ING Bank Śląski',website:'https://www.ing.pl'}],
  UA:[{name:'PrivatBank',website:'https://privatbank.ua'},{name:'Oschadbank',website:'https://www.oschadbank.ua'},{name:'Raiffeisen Bank Ukraine',website:'https://raiffeisen.ua'},{name:'PUMB',website:'https://www.pumb.ua'}],
  CA:[{name:'Royal Bank of Canada',website:'https://www.rbc.com'},{name:'TD Bank',website:'https://www.td.com'},{name:'Scotiabank',website:'https://www.scotiabank.com'},{name:'Bank of Montreal',website:'https://www.bmo.com'}],
  AU:[{name:'Commonwealth Bank',website:'https://www.commbank.com.au'},{name:'Westpac',website:'https://www.westpac.com.au'},{name:'ANZ',website:'https://www.anz.com.au'},{name:'National Australia Bank',website:'https://www.nab.com.au'}],
  JP:[{name:'MUFG Bank',website:'https://www.bk.mufg.jp'},{name:'Sumitomo Mitsui Banking Corporation',website:'https://www.smbc.co.jp'},{name:'Mizuho Bank',website:'https://www.mizuhobank.com'},{name:'Japan Post Bank',website:'https://www.jp-bank.japanpost.jp'}],
  CN:[{name:'Industrial and Commercial Bank of China',website:'https://www.icbc.com.cn'},{name:'China Construction Bank',website:'https://www.ccb.com'},{name:'Agricultural Bank of China',website:'https://www.abchina.com'},{name:'Bank of China',website:'https://www.boc.cn'}],
  IN:[{name:'State Bank of India',website:'https://sbi.co.in'},{name:'HDFC Bank',website:'https://www.hdfcbank.com'},{name:'ICICI Bank',website:'https://www.icicibank.com'},{name:'Axis Bank',website:'https://www.axisbank.com'}],
  AE:[{name:'Emirates NBD',website:'https://www.emiratesnbd.com'},{name:'First Abu Dhabi Bank',website:'https://www.bankfab.com'},{name:'Abu Dhabi Commercial Bank',website:'https://www.adcb.com'},{name:'Mashreq',website:'https://www.mashreq.com'}],
  SG:[{name:'DBS Bank',website:'https://www.dbs.com'},{name:'OCBC Bank',website:'https://www.ocbc.com'},{name:'United Overseas Bank',website:'https://www.uobgroup.com'},{name:'Standard Chartered Singapore',website:'https://www.sc.com/sg'}],
  BE:[{name:'KBC Bank',website:'https://www.kbc.com'},{name:'Belfius Bank',website:'https://www.belfius.be'},{name:'BNP Paribas Fortis',website:'https://www.bnpparibasfortis.com'},{name:'ING Belgium',website:'https://www.ing.be'}],
  SE:[{name:'SEB',website:'https://sebgroup.com'},{name:'Swedbank',website:'https://www.swedbank.com'},{name:'Handelsbanken',website:'https://www.handelsbanken.com'},{name:'Nordea Bank',website:'https://www.nordea.com'}],
  NO:[{name:'DNB Bank',website:'https://www.dnb.no'},{name:'SpareBank 1',website:'https://www.sparebank1.no'},{name:'Nordea Norway',website:'https://www.nordea.no'},{name:'Danske Bank Norway',website:'https://danskebank.no'}],
  DK:[{name:'Danske Bank',website:'https://danskebank.com'},{name:'Nykredit Bank',website:'https://www.nykredit.com'},{name:'Jyske Bank',website:'https://www.jyskebank.dk'},{name:'Sydbank',website:'https://www.sydbank.dk'}],
  FI:[{name:'OP Financial Group',website:'https://www.op.fi'},{name:'Nordea Finland',website:'https://www.nordea.fi'},{name:'Danske Bank Finland',website:'https://danskebank.fi'},{name:'S-Bank',website:'https://www.s-pankki.fi'}],
}

export function curatedBanks(country:string):BankDirectoryEntry[]{
  return (curated[country.toUpperCase()]||[]).map((bank,index)=>({id:`curated:${country.toUpperCase()}:${index}`,name:bank.name,bic:bank.bic||null,website:bank.website||null,logoUrl:null,source:'curated'}))
}

export function safeWikimediaLogo(value:string|null|undefined){
  if(!value)return null
  try{
    const url=new URL(value.replace(/^http:/,'https:'))
    if(!['commons.wikimedia.org','upload.wikimedia.org'].includes(url.hostname))return null
    return url.toString()
  }catch{return null}
}
