const near='https://docs.near.org';
const llama='https://defillama.com/chain/near';
const intents='https://docs.near-intents.org';
const metric=(id,title,definition,source,url,caveat)=>({id,title,definition,source,url,caveat});

export const categories=[
  {id:'network',title:'Network',question:'What does NEAR execute, and how reliably?',color:'#47738b',groups:[
    {id:'execution',title:'Execution',question:'How much work reaches the chain?',metrics:[
      metric('transactions','Transactions','Count distinct signed transaction hashes included in finalized blocks, per day.','NEAR transaction lifecycle',`${near}/protocol/transactions/transaction-execution`,'One transaction can generate multiple receipts; transaction count is not completed user outcomes.'),
      metric('receipts','Execution receipts','Count action receipts executed, split by success and failure, per day.','NEAR RPC',`${near}/api/rpc/transactions`,'Keep data and refund receipts separate. Do not add receipt counts to transaction counts.'),
      metric('gas','Gas consumed','Sum execution gas burnt by finalized outcomes, expressed in Tgas.','NEAR gas documentation',`${near}/protocol/transactions/gas`,'Prepaid gas is a limit, not usage. Reconcile transaction and receipt outcomes without duplication.')
    ]},
    {id:'performance',title:'Performance',question:'Does activity translate into dependable execution?',metrics:[
      metric('latency','Execution latency','Median and 95th percentile time from inclusion to finalized execution.','NEAR RPC',`${near}/api/rpc/transactions`,'Inclusion, optimistic execution and complete finality are different milestones; disclose indexer timing limits.'),
      metric('failures','Failure rate','Failed action receipts divided by all executed action receipts.','NEAR RPC',`${near}/api/rpc/transactions`,'Receipt failure does not always imply the entire user workflow failed.'),
      metric('shards','Shard workload','Gas consumed and chunk production by shard, alongside the active shard configuration.','NEAR protocol configuration',`${near}/api/rpc/protocol`,'Compare observed utilization with the configuration effective at each block, not advertised peak TPS.')
    ]},
    {id:'security',title:'Security',question:'Who supplies the network’s security?',metrics:[
      metric('stake','Staked NEAR','Native tokens in the active validator set and their share of total supply.','NEAR validators',`${near}/protocol/network/validators`,'Use epoch snapshots; liquid staking deposits are claims on stake and must not be added again.'),
      metric('concentration','Stake concentration','Stake share of the largest validators, with an explicitly stated threshold.','NEAR validators',`${near}/protocol/network/validators`,'Validator accounts are not necessarily independent operators; entity attribution requires separate evidence.')
    ]}
  ]},
  {id:'participation',title:'Participation',question:'Who returns, and who pays?',color:'#3e8067',groups:[
    {id:'reach',title:'Reach',question:'How broad is observable participation?',metrics:[
      metric('active','Active signers','Distinct transaction signer accounts in a day, week or month.','NEAR account model',`${near}/protocol/accounts-contracts/account-model`,'Accounts are not people. Contract accounts, relayers and automated activity need separate labels.'),
      metric('new','New active accounts','Accounts making their first observed signed transaction in the covered history.','NEAR transaction anatomy',`${near}/protocol/transactions/transaction-anatomy`,'First observed activity is not account creation; incomplete history biases the result.'),
      metric('payers','Fee payers','Distinct accounts charged execution fees, with sponsored activity separated where identifiable.','NEAR meta transactions',`${near}/protocol/transactions/meta-tx`,'The initiator, signer and economic fee payer can differ; resolve relayed transactions explicitly.')
    ]},
    {id:'durability',title:'Durability',question:'Does participation persist beyond acquisition?',metrics:[
      metric('retention','Cohort retention','Share of first-active account cohorts that transact again in subsequent weeks.','NEAR transaction records',`${near}/api/rpc/transactions`,'A recurring bot can be retained. This is account retention, not human retention.'),
      metric('frequency','Activity frequency','Distribution of active days per account within a fixed observation window.','NEAR transaction records',`${near}/api/rpc/transactions`,'Prefer a distribution to an average dominated by high-frequency accounts.'),
      metric('dependence','Application dependence','Share of active accounts and gas attributable to the largest labeled applications.','Token Terminal ecosystem reference','https://tokenterminal.com/explorer/projects/near-protocol','An account may use multiple apps. Define exclusive versus overlapping attribution before summing shares.')
    ]}
  ]},
  {id:'capital',title:'Capital',question:'What capital is present, and where is it used?',color:'#b58a43',groups:[
    {id:'liquidity',title:'Liquidity base',question:'What assets are available to the ecosystem?',metrics:[
      metric('stablecoins','Stablecoin supply','Outstanding tracked stablecoins on NEAR, split by issuer and representation.','DefiLlama',llama,'Supply is a stock, not transfer volume. Check backing, bridge representations and asset coverage.'),
      metric('bridged','Bridged assets','Assets represented on NEAR, grouped by origin and bridge.','DefiLlama definitions','https://docs.llama.fi/analysts/data-definitions','Bridged assets and DeFi TVL overlap. Never sum them as independent ecosystem capital.'),
      metric('net-flows','Net bridge flows','Tracked inbound value minus outbound value over a stated interval.','DefiLlama',llama,'Coverage depends on tracked bridges; price changes, native issuance and internal transfers need separate treatment.')
    ]},
    {id:'deployment',title:'Capital deployment',question:'Where is capital put to work?',metrics:[
      metric('tvl','DeFi TVL','Tracked deposited assets in NEAR DeFi applications, with inclusion settings stated.','DefiLlama definitions','https://docs.llama.fi/analysts/data-definitions','Separate liquid staking, borrowed assets and repeated collateral claims; TVL moves with prices.'),
      metric('borrowing','Outstanding borrowing','Outstanding loan principal by lending market and collateral.','DefiLlama',llama,'Borrowing is not an additional deposit. Reconcile debt tokens, liquidation and bad debt.'),
      metric('capital-concentration','Capital concentration','Share of tracked TVL held by the largest applications and sectors.','DefiLlama',llama,'Use chain-attributed balances, not the full multichain TVL displayed beside a protocol name.')
    ]}
  ]},
  {id:'applications',title:'Applications',question:'Which services generate economic activity?',color:'#a76465',groups:[
    {id:'markets',title:'Markets',question:'What is being exchanged or financed?',metrics:[
      metric('dex','DEX trading','Settled spot trading volume on NEAR venues, broken down by venue and asset pair.','DefiLlama',llama,'Exclude Intents cross-chain routing from native DEX totals unless the venue executed the trade.'),
      metric('lending','Lending utilization','Borrowed principal divided by available supplied capital, by lending pool.','DefiLlama protocol listings',llama,'Utilization is pool-specific; use underlying units and account for unusable reserves.'),
      metric('transfers','Asset transfers','Successful fungible-token transfers, with count and USD value reported separately.','NEAR contract events',`${near}/smart-contracts/anatomy/events`,'Filter internal accounting, mint/burn and self-transfers. Transfer value is not payment revenue.')
    ]},
    {id:'monetization',title:'Monetization',question:'Who earns from application activity?',metrics:[
      metric('app-fees','Application fees','User charges generated by labeled applications, separated by product.','DefiLlama definitions','https://docs.llama.fi/analysts/data-definitions','Do not mix gross trading volume with fees, or add application fees to chain fees without naming the scope.'),
      metric('app-retained','Retained application revenue','The portion of application fees retained after supplier payouts.','DefiLlama definitions','https://docs.llama.fi/analysts/data-definitions','Application receipts are not automatically revenue or cash flow belonging to NEAR token holders.'),
      metric('app-diversity','Revenue concentration','Contribution of each application to tracked ecosystem fee generation.','Token Terminal ecosystem reference','https://tokenterminal.com/explorer/projects/near-protocol','Track missing applications and methodology changes; a dominant app can obscure the rest of the ecosystem.')
    ]}
  ]},
  {id:'intents',title:'Intents & AI',question:'Can cross-chain settlement serve a machine-driven economy?',color:'#746a9b',groups:[
    {id:'settlement',title:'Settlement',question:'What outcomes are completed across chains?',metrics:[
      metric('intent-volume','Settled swap volume','USD input value of completed tracked 1Click swaps, counted once per unique swap.','NEAR Intents Explorer documentation',`${intents}/integration/distribution-channels/1click-api/explorer/introduction`,'Do not sum both legs. The authenticated 1Click Explorer is not complete coverage of every Intents integration.'),
      metric('routes','Chain and asset routes','Completed swaps grouped by origin chain, destination chain and asset pair.','NEAR Intents API',`${intents}/api-reference/get-transactions`,'Supported routes do not prove used routes. Routed volume is not native NEAR DEX volume.'),
      metric('completion','Completion and latency','Completion rate and elapsed settlement time for a defined submitted-swap cohort.','NEAR Intents status API',`${intents}/api-reference/oneclick/check-swap-execution-status`,'Successful-only historical endpoints cannot establish a failure rate; requires complete submitted-order coverage.')
    ]},
    {id:'distribution',title:'Distribution',question:'Where does demand originate, and what does it pay?',metrics:[
      metric('integrators','Integrator mix','Swap count and settled volume attributed to identified distribution partners.','NEAR Intents Explorer documentation',`${intents}/integration/distribution-channels/1click-api/explorer/introduction`,'Unknown attribution is its own bucket. An integrator is not a solver and a wallet is not necessarily one user.'),
      metric('intent-fees','Intents fee flows','Gross charges, partner payments and retained receipts reconciled to identifiable recipients.','NEAR Intents fee documentation',`${intents}/resources/fees`,'Do not infer token-holder capture from the gross fee rate or dashboard revenue labels.'),
      metric('intent-users','Returning intent accounts','Repeat observable initiators across a fixed window, with coverage clearly identified.','NEAR Intents verifier',`${intents}/integration/verifier-contract/account-abstraction`,'Cross-chain identities, relayers and confidential activity prevent a direct conversion to unique people.')
    ]},
    {id:'agent-adoption',title:'Agent adoption',question:'Can agent usage be identified rather than assumed?',metrics:[
      metric('verified-agents','Attributed agent activity','Completed swaps linked to a disclosed, independently checked registry of agent integrations.','NEAR Intents agent tooling',`${intents}/integration/devkit/skills`,'Tool availability is not adoption. No agent classification from wallet behavior alone; registry coverage must be disclosed.'),
      metric('agent-persistence','Agent repeat usage','Repeat settled activity from verified agent integrations across consistent observation windows.','NEAR Intents agent tooling',`${intents}/integration/devkit/skills`,'An integration can serve humans and agents. Require verifiable separation before assigning volume or fees to AI.')
    ]}
  ]},
  {id:'token',title:'Token economics',question:'How does network activity reach the token?',color:'#597b76',groups:[
    {id:'flow',title:'Supply flows',question:'What enters and leaves token supply?',metrics:[
      metric('issuance','Token issuance','NEAR minted over each period, reconciled to supply changes and reward records.','nearcore economics','https://github.com/near/nearcore/blob/master/docs/Economics/Economics.md','Use observed issuance and block-effective configuration; historical headline inflation rates may be superseded.'),
      metric('burn','Gas fees and burn','Gas charges in NEAR, split into burnt amounts and any block-effective contract rewards.','NEAR gas documentation',`${near}/protocol/transactions/gas`,'Verify each block’s protocol version. Historical contract rebates must not be carried into a later all-burn regime.'),
      metric('net-supply','Net supply change','Opening supply plus issuance minus burns and any separately reconciled adjustments.','NEAR protocol RPC',`${near}/api/rpc/protocol`,'Separate total supply from circulating supply; bridge transfers and staking do not create native tokens.')
    ]},
    {id:'linkage',title:'Economic linkage',question:'Which mechanisms create observable NEAR demand?',metrics:[
      metric('storage','Storage balances','NEAR required to cover on-chain state, tracked separately from staking and free balances.','NEAR storage documentation',`${near}/protocol/storage/storage-staking`,'Storage balances can be released when state is removed; they are not a fee paid to token holders.'),
      metric('staking-yield','Staking rewards','Gross rewards, validator commission and supply-adjusted return shown separately.','NEAR staking documentation',`${near}/protocol/tutorials/staking-tokens`,'Nominal rewards are not external revenue. Compare the same epoch and supply basis.'),
      metric('buybacks','Product-to-token flows','Verified purchases, burns or distributions funded by identifiable product receipts.','NEAR Revenue tracker','https://revenue.near.org/','Treat dashboard claims as a starting point. Verify transactions, recipients and implementation before claiming capture.')
    ]}
  ]}
];

export const sources=[
  {title:'DefiLlama · NEAR',url:llama,note:'Accessible chain overview informed capital and application categories. No current values are used here.'},
  {title:'DefiLlama · definitions',url:'https://docs.llama.fi/analysts/data-definitions',note:'Metric boundaries; adapter-specific treatment still needs verification.'},
  {title:'Token Terminal · NEAR',url:'https://tokenterminal.com/explorer/projects/near-protocol',note:'Overview, ecosystem, metrics and financial-statement navigation was visible. Underlying metric series and queries were not inspected.'},
  {title:'DefiLlama · investor page',url:'https://investors.defillama.com/near',note:'Fetched page exposed an overview coming-soon message; no full investor dashboard was available for inspection.'},
  {title:'NEAR · protocol documentation',url:`${near}/protocol/network/architecture`,note:'Primary definitions for transactions, receipts, gas, accounts and staking.'},
  {title:'NEAR Intents · documentation',url:intents,note:'Linked fee, agent, verifier, Explorer and status pages were readable. Explorer requires partner credentials and covers 1Click; no API records or Dune queries were inspected.'}
];
