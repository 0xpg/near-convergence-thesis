"""Render the dated report and figures from the shared engine's checked outputs."""
from pathlib import Path
import hashlib
import json
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.barcharts import VerticalBarChart, HorizontalBarChart
from reportlab.graphics import renderSVG

ROOT = Path(__file__).resolve().parents[1]
out = json.loads((ROOT / 'data/outputs.json').read_text())
research = json.loads((ROOT / 'data/research.json').read_text())
inputs = json.loads((ROOT / 'data/inputs.json').read_text())
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)
ink = colors.HexColor('#193a3a')
teal = colors.HexColor('#167269')
copper = colors.HexColor('#a6532f')
paper = colors.HexColor('#f5f1e8')
muted = colors.HexColor('#4c5d5a')
styles = {
    'eyebrow': ParagraphStyle('eyebrow', fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=teal, spaceAfter=16),
    'title': ParagraphStyle('title', fontName='Times-Roman', fontSize=36, leading=39, textColor=ink, spaceAfter=22),
    'h1': ParagraphStyle('h1', fontName='Times-Roman', fontSize=27, leading=31, textColor=ink, spaceAfter=18),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=12, leading=17, textColor=ink, spaceBefore=14, spaceAfter=7),
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=10.5, leading=15.5, textColor=ink, spaceAfter=12),
    'small': ParagraphStyle('small', fontName='Helvetica', fontSize=8.5, leading=12, textColor=muted, spaceAfter=9),
    'lead': ParagraphStyle('lead', fontName='Times-Roman', fontSize=17, leading=23, textColor=ink, spaceAfter=18),
}
def p(text, style='body'):
    text = text.translate(str.maketrans({'\u2013':'-', '\u2014':'-', '\u2011':'-', '\u2019':"'", '\u2018':"'", '\u201c':'"', '\u201d':'"', '\ufffd':"'"}))
    return Paragraph(text, styles[style])

def plot(values, labels, unit, horizontal=False, palette=None):
    drawing = Drawing(500, 235)
    chart = HorizontalBarChart() if horizontal else VerticalBarChart()
    chart.x, chart.y, chart.width, chart.height = (130, 32, 310, 180) if horizontal else (46, 35, 410, 175)
    chart.data = [values]
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontName = 'Helvetica'
    chart.categoryAxis.labels.fontSize = 12
    chart.valueAxis.labels.fontName = 'Helvetica'
    chart.valueAxis.labels.fontSize = 11
    chart.valueAxis.valueMin = 0
    chart.valueAxis.visibleGrid = True
    chart.valueAxis.gridStrokeColor = colors.HexColor('#dddcd4')
    chart.valueAxis.strokeColor = colors.HexColor('#9aaca4')
    chart.categoryAxis.strokeColor = colors.HexColor('#9aaca4')
    chart.bars[0].fillColor = teal
    chart.bars[0].strokeColor = None
    if palette:
        for i, color in enumerate(palette):
            chart.bars[(0, i)].fillColor = color
    chart.barLabelFormat = '%.2f' if not horizontal else '%.1f'
    chart.barLabels.fontSize = 11
    chart.barLabels.fillColor = ink
    chart.barLabels.nudge = 8
    chart.valueAxis.valueMax = max(values) * 1.18
    drawing.add(chart)
    drawing.add(String(46 if not horizontal else 130, 222, unit, fontName='Helvetica', fontSize=10, fillColor=muted))
    return drawing

adoption = plot([x['volume'] / 1e9 for x in out['monthly']], ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], 'Reported volume / USD billions per month')
channels = sorted(out['channels'], key=lambda x: x['share_pct'], reverse=True)
top = channels[:3]
channelplot = plot([100-sum(x['share_pct'] for x in top)] + [x['share_pct'] for x in reversed(top)], ['Other labels'] + [x['name'] for x in reversed(top)], 'Share of distribution fees / %', True)
illustrative = out['illustrative']
scale = plot([illustrative['retainedPurchases']/1e6, illustrative['issuanceValueAtReferencePrice']/1e6], ['All receipts retained', 'Issuance ceiling'], 'USD millions / annual scale at historical $4.44', palette=[copper,teal])
for filename, drawing in [('adoption.svg',adoption),('channels.svg',channelplot),('supply.svg',scale)]:
    renderSVG.drawToFile(drawing, str(assets / filename))

story=[]
def add(*items):
    story.extend(items)
def page(number,title):
    if story: add(PageBreak())
    add(p(f'NEAR / INVESTMENT RESEARCH     {number:02d}', 'eyebrow'),p(title,'h1'))
def source(text):
    add(p(text,'small'))

add(p('NEAR / INDEPENDENT INVESTMENT RESEARCH', 'eyebrow'), Spacer(1,22), p('The business is scaling.<br/>The token link remains conditional.','title'),p(research['selectedThesis'],'lead'))
add(p('Our assessment','h2'),p('Intents is an operating cross-chain distribution service, with reported activity and fees that justify serious research. The accessible evidence establishes commercial scale more strongly than it establishes lasting token demand. We therefore underwrite a conditional franchise, without a directional trade recommendation or a price target.'))
add(p('What would change the conclusion','h2'),p('The bullish case strengthens when recurring external fee income can be reconciled to executed purchases, end-period NEAR custody and subsequent disposals over complete repeated periods. It weakens if route mix, partner bargaining or incentives consume the apparent economics before lasting demand reaches the token.'))
add(p('Read this report with the interactive website','h2'),p('The narrative, source inspectors, frozen Dune fallbacks and Scenario Lab use the same versioned analytical outputs. Scenario inputs are hypothetical; a zero default for credited purchases means the link is unverified, not that actual purchases are measured at zero.'))
source('Research edition: 2 November 2026. Monthly comparison: April-September 2026. Model window: 23 September-22 October. Distribution window: 27 September-26 October. Historical market reference: 25 October, 06:19:54 UTC. Model '+out['modelVersion']+' / '+out['snapshotVersion']+'. No live price or subsequent dashboard refresh is incorporated.')

page(2,'Commercial scale is visible.\nDemand quality is less settled.')
add(p(f"Q3 reported volume grew {out['growth']['volumePct']:.1f}% over Q2; gross fees grew {out['growth']['feesPct']:.1f}%. Tracked collection-wallet receipts grew {out['growth']['receiptsPct']:.1f}%. The measures are related, but do not represent the same economic rights.",'lead'),adoption)
add(p('What the chart answers','h2'),p('Has reported activity expanded across comparable periods? Full calendar-month volume increased from $1.90bn in April to $4.80bn in September. This monthly comparison is a flow measure, not users, retained capital, profit or organic demand. Reported volume can include incentive-sensitive and automated activity.'))
add(p('The strongest competing explanation','h2'),p('A few distribution partners, subsidized routing or a favorable asset mix could explain growth without a durable customer franchise. Real 30/60/90-day paying-customer retention and actual incentive costs remain unmeasured. Selected-date origin-account recurrence cannot substitute for that evidence.'))
source('Source: saved aligned DefiLlama daily series, data/snapshots/daily.csv; extraction and monthly transformation: analysis/reproduce.mjs. DefiLlama and Dune share project-maintained upstream data. These are not independent confirmations. See data/research.json claim growth and data/monthly.csv.')

page(3,'Follow the fee before\ncrediting the token.')
add(p('1 / Customer outcome','h2'),p('A user requests an exchange across assets or networks. The notional routed is an activity measure. It is not NEAR-token revenue. Solvers, applications and channels can each retain value.'))
add(p('2 / Realized route economics','h2'),p('Official documentation distinguishes a 0.0001% verifier fee (1 part per million; 0.01 basis points) from route-dependent commercial fees. The frontend tariff is 20 basis points; API and partner schedules vary, and stablecoin or same-asset routes may carry lower fees. A published tariff is not an observed average retained rate.'))
add(p('3 / Collection and allocation','h2'),p('The model window records $6.782m in reported gross fees and $2.225m of tracked collection-wallet receipts. The latter is not reconciled net profit: source-period attribution, expenses, incentives and recipient obligations remain incomplete. Costs already reflected in receipts must not be deducted again.'))
add(p('4 / Conversion and custody','h2'),p('Saved receipts establish sampled token transfers into a named wallet. They do not prove every incoming unit was bought from external fee proceeds or retained. Metadata-linked source credits fee assets to an internal collector; it does not itself establish automatic market purchases or burns. Deployed WASM was not independently reproduced.'))
add(p('5 / Lasting token demand','h2'),p('NEAR denomination can create transient working balances. Sustained market absorption depends on purchase execution and retention; payouts may later be sold. Governance-controlled uses of proceeds create no demonstrated immutable tokenholder distribution entitlement. Permanent protocol burn must remain separate from reversible wallet accumulation.'))
source('Primary references: docs.near-intents.org/resources/fees (reviewed 2 November); near.org/blog/evolving-near-tokenomics (24 February); saved receipts and protocol source excerpt in data/snapshots/. Official policy describes intended linkage; the origin-to-custody reconciliation remains incomplete. Source pins and claim token-link: data/research.json.')

page(4,'Distribution is an asset.\nConcentration is a risk.')
add(p(f"The top three referral labels account for {sum(x['share_pct'] for x in top):.2f}% of measured distribution fees in the saved 30-day window.",'lead'),channelplot)
add(p('Why it matters','h2'),p('A large partner can supply efficient distribution and improve utilization. The same dependence can increase bargaining power, route substitution and fee pressure. A shift toward lower-fee stablecoin routes can grow notional while reducing retained dollars per unit.'))
add(p('What is not established','h2'),p('Referral labels are source classifications, not independently verified beneficial owners, customer cohorts or contractual counterparties. Concentration alone does not prove partner leverage, margin compression or a failing moat. We need partner renewal terms, route-weighted retained fee histories and substitution evidence.'))
add(p('A falsifiable test','h2'),p('Compare complete periods before and after partner renewals or route-mix changes. Track realized gross and retained fees per dollar alongside recurring economic customers and incentives. Durable retained economics despite broader distribution would weaken the fragility hypothesis.'))
source('Source: Dune query 9019424, saved execution output data/snapshots/channels.json; fixed dates 27 September-26 October UTC. Percentages use distribution fees, not total Intents gross fees or token receipts. SQL: data/queries/referral_mix.sql. Query labels remain provider-controlled.')

page(5,'A scenario is a test,\nnot a price target.')
add(p('Shared engine: analysis/model.mjs','eyebrow'),p(f"The saved operating window annualizes to ${illustrative['volume']/1e9:.2f}bn of volume and ${illustrative['walletReceipts']/1e6:.2f}m of tracked wallet receipts. Annualization holds the 30-day rate constant; it is not a forecast."))
add(p('The all-receipts-retained illustration','h2'),p(f"Assume every receipt dollar is additional-cost-free, used to acquire NEAR and retained. The resulting ${illustrative['retainedPurchases']/1e6:.2f}m equals {illustrative['absorptionPctOfValue']:.3f}% of the ${illustrative['referenceValue']/1e9:.3f}bn total-supply reference value. It is not a measured purchase yield, dividend, return or bound on other possible demand."),scale)
add(p('Reverse the assumption','h2'),p(f"At the same fees and retained share, a discretionary 2% annual absorption-to-reference-value hurdle requires ${illustrative['requiredVolume']/1e9:.1f}bn in annual volume. This solves an analyst-selected pressure ratio. It does not reveal market expectations, intrinsic value or the future NEAR price."))
source('Retained purchases = annual volume x gross fee bps / 10,000 x receipt share x (1 - additional cost share) x purchase share x retention share. Issuance = pinned supply x selected annual rate. All shares are fractions. Issuance ceiling is not observed issuance, token selling or a dollar funding requirement. This comparison neither offsets supply nor computes net issuance. Gas burn is excluded because a full census is unavailable.')

page(6,'The alternatives matter.\nNeither supplies a price verdict.')
for candidate in research['candidates']:
    add(p(candidate['name'],'h2'),p(candidate['claim']+' '+candidate['strength']+' '+candidate['weakness']))
add(p('Why choose the conditional franchise','h2'),p(research['decision']))
add(p('The strongest objection to our stance','h2'),p(research['counterargument']))
add(p('Supply and staking counterweight','h2'),p('Pinned mainnet configuration permits maximum annual issuance of 2.5%. A lower ceiling reduces dilution for non-stakers, but staking issuance is principally redistribution, not external income. Stake participation, validator commission and realized issuance determine relative outcomes. The already-announced supply change alone establishes no overlooked pricing catalyst.'))
source('Block 221500732 / 25 October 2026. Supply and protocol configuration are preserved and recalculated offline. Current mainnet state may differ. A quarter-wide actual mint/burn census and a market event study were not performed. No fee multiple or equity cash-flow right is assumed.')

page(7,'What survives inspection\nand what remains unresolved.')
add(p('Reconciliation before interpretation','h2'),p('For 27 September-26 October, saved Dune and API volume agree within $1. Their common upstream lineage prevents treating this as independent validation. Dune gross fees exceed the API by $145,994.83, or 2.237% of Dune. This unresolved discrepancy is retained; fee series are not spliced. The Q3 API volume ($9.786bn) also differs from the supplied report ($10.41bn).'))
add(p('Conditions that would change our view','h2'))
for text in [
    'Strengthen: multiple complete months reconcile external fee origin to purchases, ending custody and disposals, with independently auditable recipient obligations.',
    'Weaken: recurring economic customers or retained route-level fees deteriorate after incentives normalize or partners renew.',
    'Strengthen: enforceable implemented economics connect service proceeds to durable token demand, confirmed in active configuration and receipts.',
    'Keep inconclusive: data cannot distinguish purchases from transfers, retained earnings from distributions, or customers from sponsored accounts.'
]: add(p(text))
add(p('How to reproduce','h2'),p('Node 20 or later: npm test; npm run build. The first command checks snapshot hashes, daily and monthly aggregation, supply conversion, configuration and model boundaries. Serve only dist/ on localhost: python -m http.server 4187 --bind 127.0.0.1 --directory dist. No paid credentials are needed. Download the JSON inputs and outputs from the site to reproduce a scenario with the shared engine.'))
source('Report generation is separate: install reportlab, then run python scripts/report.py after rerunning analysis. This report is generated from data/outputs.json; report-source.json fingerprints the analytical inputs and engine. The build rejects a stale report. Source refresh creates a new dated snapshot and does not silently revise this edition. Cached Dune output can lag; a refreshed dashboard does not update this report.')

page(8,'Sources and analytical limits')
for item in research['sources']:
    url=escape(item['url'], {'"':'&quot;'})
    add(KeepTogether([p(escape(item['title']),'h2'),p(f'<link href="{url}" color="#167269">{url}</link>','small'),p(escape(item['period']+'. '+item['extraction']+' '+item['independence']),'small')]))
source('Full claim-by-claim records, raw snapshots, fixed SQL, hashes, periods, methods, assumptions and falsifiers: data/research.json and data/manifest.json in the repository and website downloads. These public-source observations do not establish customer-level retention, actual incentive costs, comprehensive fee conversion, or an investable excess return. No confidential customer data or paid execution is included.')

def footer(canvas, doc):
    width,height=doc.pagesize
    canvas.saveState()
    canvas.setFillColor(paper)
    canvas.rect(0,0,width,height,fill=1,stroke=0)
    canvas.setStrokeColor(colors.HexColor('#cbd0c6'))
    canvas.line(46,height-34,width-46,height-34)
    canvas.setFont('Helvetica',8)
    canvas.setFillColor(muted)
    canvas.drawString(46,27,'NEAR / The missing link     |     Research edition 02 Nov 2026')
    canvas.drawRightString(width-46,27,str(doc.page))
    canvas.restoreState()

doc=SimpleDocTemplate(str(ROOT/'report.pdf'),pagesize=(595.28,841.89),rightMargin=46,leftMargin=46,topMargin=55,bottomMargin=48,title='NEAR: The missing link',author='NEAR Research',subject=out['snapshotVersion']+' / model '+out['modelVersion'])
doc.build(story,onFirstPage=footer,onLaterPages=footer)
fingerprint={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['data/inputs.json','data/outputs.json','data/research.json','analysis/model.mjs']}
(ROOT/'report-source.json').write_text(json.dumps(fingerprint,indent=2)+'\n')
print('Created report.pdf and three shared-data SVG figures')
