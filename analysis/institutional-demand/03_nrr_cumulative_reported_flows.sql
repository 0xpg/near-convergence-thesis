-- One bounded, attributed public chart excerpt. Source: cryptoetf.today
-- Secondary-provider reported net creations/redemptions; not primary audited cash flows or institutional ownership.
-- Archived chart observations: 29 Sep–12 Nov 2026; rerunning SQL does not refresh provider data.
WITH daily(day,reported_net_flow_usd) AS (
 VALUES
 (DATE '2026-09-29',DECIMAL '35987000.00'),
 (DATE '2026-09-30',DECIMAL '14039000.00'),
 (DATE '2026-10-01',DECIMAL '8083000.00'),
 (DATE '2026-10-02',DECIMAL '242000.00'),
 (DATE '2026-10-05',DECIMAL '540000.00'),
 (DATE '2026-10-06',DECIMAL '0.00'),
 (DATE '2026-10-07',DECIMAL '3339000.00'),
 (DATE '2026-10-08',DECIMAL '4038000.00'),
 (DATE '2026-10-09',DECIMAL '5131000.00'),
 (DATE '2026-10-12',DECIMAL '3985000.00'),
 (DATE '2026-10-13',DECIMAL '3933000.00'),
 (DATE '2026-10-14',DECIMAL '0.00'),
 (DATE '2026-10-15',DECIMAL '1126000.00'),
 (DATE '2026-10-16',DECIMAL '2606000.00'),
 (DATE '2026-10-19',DECIMAL '5419000.00'),
 (DATE '2026-10-20',DECIMAL '-2539000.00'),
 (DATE '2026-10-21',DECIMAL '831000.00'),
 (DATE '2026-10-22',DECIMAL '513000.00'),
 (DATE '2026-10-23',DECIMAL '993000.00'),
 (DATE '2026-10-26',DECIMAL '1405000.00'),
 (DATE '2026-10-27',DECIMAL '-4839000.00'),
 (DATE '2026-10-28',DECIMAL '0.00'),
 (DATE '2026-10-29',DECIMAL '0.00'),
 (DATE '2026-10-30',DECIMAL '0.00'),
 (DATE '2026-11-02',DECIMAL '0.00'),
 (DATE '2026-11-03',DECIMAL '-3604000.00'),
 (DATE '2026-11-04',DECIMAL '0.00'),
 (DATE '2026-11-05',DECIMAL '-774000.00'),
 (DATE '2026-11-06',DECIMAL '0.00'),
 (DATE '2026-11-09',DECIMAL '0.00'),
 (DATE '2026-11-10',DECIMAL '0.00'),
 (DATE '2026-11-11',DECIMAL '-1358000.00'),
 (DATE '2026-11-12',DECIMAL '0.00')
)
SELECT day,reported_net_flow_usd,
 sum(reported_net_flow_usd) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_reported_net_flow_usd,
 'NRR · U.S. spot NEAR ETF' AS fund,
 'Source: cryptoetf.today' AS attribution,
 'https://cryptoetf.today/en/etf/nrr-etf-price' AS source_url,
 'Reported net creations/redemptions, USD; 33 published sessions, 29 Sep–12 Nov 2026. Archived attributed chart excerpt, not live data, institutional investor identity, AUM or token-holdings change.' AS coverage,
 current_timestamp AS query_executed_utc
FROM daily ORDER BY day
