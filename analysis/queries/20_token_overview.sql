-- Public RPC finalized-state observation. Total supply is not circulating or locked supply.
-- Preserve returned block hash/height and raw yoctoNEAR for a reproducible snapshot.
-- For exact re-execution replace {"finality":"final"} with {"block_id":RETURNED_HEIGHT}.
WITH response AS (
 SELECT json_parse(http_post(
  'https://rpc.mainnet.near.org',
  '{"jsonrpc":"2.0","id":"token-overview","method":"block","params":{"finality":"final"}}',
  ARRAY['Content-Type: application/json']
 )) AS data
)
SELECT
 json_extract_scalar(data,'$.result.header.hash') AS block_hash,
 CAST(json_extract_scalar(data,'$.result.header.height') AS bigint) AS block_height,
 json_extract_scalar(data,'$.result.header.timestamp_nanosec') AS timestamp_nanosec,
 json_extract_scalar(data,'$.result.header.total_supply') AS total_supply_yoctonear,
 CAST(json_extract_scalar(data,'$.result.header.total_supply') AS double)/1e24 AS total_supply_near,
 json_extract_scalar(data,'$.error.message') AS rpc_error
FROM response;
