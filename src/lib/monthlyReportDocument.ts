import type { MonthlyReportData } from './metrics/monthlyReportMetrics';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pct(n: number | null): string {
  return n !== null ? fmt(n, 1) + '%' : 'N/A';
}

function heading1(text: string): string {
  return `<w:p>
    <w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:r><w:t>${esc(text)}</w:t></w:r>
  </w:p>`;
}

function heading2(text: string): string {
  return `<w:p>
    <w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="180" w:after="80"/></w:pPr>
    <w:r><w:t>${esc(text)}</w:t></w:r>
  </w:p>`;
}

function para(text: string, bold = false): string {
  const b = bold ? '<w:b/>' : '';
  return `<w:p>
    <w:pPr><w:spacing w:after="80"/></w:pPr>
    <w:r><w:rPr>${b}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>
  </w:p>`;
}

function kv(label: string, value: string): string {
  return `<w:p>
    <w:pPr><w:spacing w:after="60"/></w:pPr>
    <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(label + ':  ')}</w:t></w:r>
    <w:r><w:t>${esc(value)}</w:t></w:r>
  </w:p>`;
}

function hline(): string {
  return `<w:p>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr>
      <w:spacing w:before="120" w:after="120"/>
    </w:pPr>
  </w:p>`;
}

type CellDef = { text: string; bold?: boolean; shade?: string; align?: 'left' | 'right' | 'center' };

function trow(cells: CellDef[], isHeader = false): string {
  return `<w:tr>${cells.map(c => {
    const shd = c.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.shade}"/>` : '';
    const jc = c.align === 'right' ? '<w:jc w:val="right"/>' : c.align === 'center' ? '<w:jc w:val="center"/>' : '';
    const b = (c.bold || isHeader) ? '<w:b/>' : '';
    return `<w:tc>
      <w:tcPr>${shd}<w:tcBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
      </w:tcBorders></w:tcPr>
      <w:p><w:pPr>${jc}<w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr>${b}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
          <w:t xml:space="preserve">${esc(c.text)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`;
  }).join('')}</w:tr>`;
}

function tblStart(width = 9000): string {
  return `<w:tbl><w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="${width}" w:type="dxa"/>
    <w:tblBorders>
      <w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>
      <w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="80" w:type="dxa"/><w:left w:w="115" w:type="dxa"/>
      <w:bottom w:w="80" w:type="dxa"/><w:right w:w="115" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>`;
}

function rowAlt(i: number): string { return i % 2 === 0 ? 'EBF5FB' : 'FFFFFF'; }

function buildContent(d: MonthlyReportData): string {
  const parts: string[] = [];

  parts.push(`
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="34"/><w:szCs w:val="34"/><w:color w:val="1A3A5C"/></w:rPr>
        <w:t>MONTHLY OPERATIONS REPORT</w:t>
      </w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/><w:color w:val="2E6FA3"/></w:rPr>
        <w:t>${esc(d.monthName + ' ' + d.year + '  |  ' + d.serviceCentreName)}</w:t>
      </w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="200"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="888888"/></w:rPr>
        <w:t>${esc('Generated: ' + new Date(d.generatedAt).toLocaleString('en-GB'))}</w:t>
      </w:r>
    </w:p>`);

  parts.push(hline());

  parts.push(heading1('1. EXECUTIVE SUMMARY'));
  parts.push(kv('Service Centre', d.serviceCentreName));
  parts.push(kv('Reporting Month', d.monthName + ' ' + d.year));
  parts.push(kv('Active Stations', String(d.production.stationCount)));
  parts.push(kv('Data Completeness', `${d.totalActualLogs} of ${d.totalExpectedLogs} station-day logs (${d.completionPct}%)`));
  parts.push(kv('Total CW Volume Produced', fmt(d.production.totalCWVolume) + ' m³'));
  parts.push(kv('Total Sales Volume', fmt(d.sales.totalEffectiveSalesVolume) + ' m³'));
  parts.push(kv('Sales Achievement', pct(d.sales.overallAchievementPct)));
  parts.push(kv('Total NRW Losses', fmt(d.nrw.totalLossVol) + ' m³  (' + pct(d.nrw.totalLossPct) + ')'));
  parts.push(kv('Total Breakdowns', String(d.breakdowns.length)));
  parts.push(kv('New Connections (Month)', String(d.production.totalNewConnections)));
  parts.push(kv('New Connections (YTD)', String(d.production.totalNewConnectionsYTD)));
  parts.push(kv('Pumping Hours Lost (Breakdowns)', d.production.totalBreakdownHoursLost > 0 ? fmt(d.production.totalBreakdownHoursLost, 1) + ' hrs' : 'None'));

  parts.push(hline());

  parts.push(heading1('2. PRODUCTION'));
  parts.push(tblStart());
  parts.push(trow([{ text: 'Metric', shade: '1A3A5C' }, { text: 'Value', shade: '1A3A5C', align: 'right' }], true));
  const prodRows: [string, string][] = [
    ['Total CW Volume', fmt(d.production.totalCWVolume) + ' m³'],
    ['Total RW Volume Abstracted', fmt(d.production.totalRWVolume) + ' m³'],
    ['Total CW Hours Run', fmt(d.production.totalCWHours, 1) + ' hrs'],
    ['Total RW Hours Run', fmt(d.production.totalRWHours, 1) + ' hrs'],
    ['Avg CW Pump Rate', d.production.avgCWPumpRate !== null ? fmt(d.production.avgCWPumpRate, 1) + ' m³/hr' : 'N/A'],
    ['Load Shedding Hours', fmt(d.production.totalLoadShedding, 1) + ' hrs'],
    ['Other Downtime Hours', fmt(d.production.totalOtherDowntime, 1) + ' hrs'],
    ['Total Downtime', fmt(d.production.totalDowntime, 1) + ' hrs'],
    ['Average Efficiency', pct(d.production.avgEfficiency)],
    ['New Connections', String(d.production.totalNewConnections)],
    ['New Connections (YTD)', String(d.production.totalNewConnectionsYTD)],
    ['Pumping Hours Lost (Breakdowns)', d.production.totalBreakdownHoursLost > 0 ? fmt(d.production.totalBreakdownHoursLost, 1) + ' hrs' : 'None'],
  ];
  prodRows.forEach(([label, value], i) => {
    parts.push(trow([{ text: label, shade: rowAlt(i) }, { text: value, align: 'right', shade: rowAlt(i) }]));
  });
  parts.push('</w:tbl>');

  if (d.production.stations.length > 0) {
    parts.push(heading2('2.1 Station Production Detail'));
    parts.push(tblStart());
    parts.push(trow([
      { text: 'Station', shade: '2E6FA3' },
      { text: 'Type', shade: '2E6FA3' },
      { text: 'CW Vol (m³)', shade: '2E6FA3', align: 'right' },
      { text: 'CW Hrs', shade: '2E6FA3', align: 'right' },
      { text: 'Efficiency', shade: '2E6FA3', align: 'right' },
      { text: 'Downtime (hrs)', shade: '2E6FA3', align: 'right' },
      { text: 'New Conn.', shade: '2E6FA3', align: 'right' },
    ], true));
    d.production.stations.forEach((st, i) => {
      parts.push(trow([
        { text: st.stationName, shade: rowAlt(i) },
        { text: st.stationType, shade: rowAlt(i) },
        { text: fmt(st.cwVolume), align: 'right', shade: rowAlt(i) },
        { text: fmt(st.cwHours, 1), align: 'right', shade: rowAlt(i) },
        { text: pct(st.efficiency), align: 'right', shade: rowAlt(i) },
        { text: fmt(st.totalDowntime, 1), align: 'right', shade: rowAlt(i) },
        { text: String(st.newConnections), align: 'right', shade: rowAlt(i) },
      ]));
    });
    parts.push('</w:tbl>');
  }

  if (d.ytdProductionVsTarget && d.ytdProductionVsTarget.stations.length > 0) {
    const ytd = d.ytdProductionVsTarget;
    parts.push(heading2('2.2 YTD CW Production Performance vs Target'));
    parts.push(`${tblStart()}
      ${trow([
        { text: 'Station', shade: '2E6FA3' },
        { text: 'YTD Production (m\u00B3)', shade: '2E6FA3', align: 'right' },
        { text: 'YTD Target (m\u00B3)', shade: '2E6FA3', align: 'right' },
        { text: 'Variance (m\u00B3)', shade: '2E6FA3', align: 'right' },
        { text: 'Achievement (%)', shade: '2E6FA3', align: 'right' },
      ], true)}
      ${ytd.stations.map((st, i) => {
        const achShade = st.achievementPct === null ? rowAlt(i)
          : st.achievementPct >= 100 ? 'E8F5E9'
          : st.achievementPct >= 80 ? 'FFF3CD' : 'FFE5E5';
        return trow([
          { text: st.stationName, shade: rowAlt(i) },
          { text: fmt(st.ytdProduction), align: 'right', shade: rowAlt(i) },
          { text: fmt(st.ytdTarget), align: 'right', shade: rowAlt(i) },
          { text: (st.variance >= 0 ? '+' : '') + fmt(st.variance), align: 'right', shade: rowAlt(i) },
          { text: st.achievementPct !== null ? fmt(st.achievementPct, 1) + '%' : 'N/A', align: 'right', shade: achShade },
        ]);
      }).join('')}
      ${trow([
        { text: 'TOTAL', shade: 'D6EAF8', bold: true },
        { text: fmt(ytd.totalYTDProduction), align: 'right', shade: 'D6EAF8', bold: true },
        { text: fmt(ytd.totalYTDTarget), align: 'right', shade: 'D6EAF8', bold: true },
        { text: (ytd.totalVariance >= 0 ? '+' : '') + fmt(ytd.totalVariance), align: 'right', shade: 'D6EAF8', bold: true },
        { text: ytd.totalAchievementPct !== null ? fmt(ytd.totalAchievementPct, 1) + '%' : 'N/A', align: 'right', shade: 'D6EAF8', bold: true },
      ])}
    </w:tbl>`);
  }

  parts.push(hline());

  parts.push(heading1('3. SALES PERFORMANCE'));

  const salesNote = d.sales.stationsWithReturnsOnly > 0
    ? `Note: ${d.sales.stationsWithReturnsOnly} station(s) using Returns data (Sage not available). ${d.sales.stationsWithSage} station(s) using confirmed Sage sales.`
    : `All ${d.sales.stationsWithSage} station(s) using confirmed Sage sales data.`;
  parts.push(para(salesNote));

  parts.push(tblStart());
  parts.push(trow([{ text: 'Metric', shade: '1A3A5C' }, { text: 'Value', shade: '1A3A5C', align: 'right' }], true));
  const salesRows: [string, string][] = [
    ['Total Sales Volume', fmt(d.sales.totalEffectiveSalesVolume) + ' m³'],
    ['Total Sales Target', fmt(d.sales.totalTargetVolume) + ' m³'],
    ['Variance vs Target', (d.sales.overallVarianceM3 >= 0 ? '+' : '') + fmt(d.sales.overallVarianceM3) + ' m³'],
    ['Achievement', pct(d.sales.overallAchievementPct)],
  ];
  salesRows.forEach(([label, value], i) => {
    parts.push(trow([{ text: label, shade: rowAlt(i) }, { text: value, align: 'right', shade: rowAlt(i) }]));
  });
  parts.push('</w:tbl>');

  if (d.sales.stations.length > 0) {
    parts.push(heading2('3.1 Sales by Station'));
    parts.push(tblStart());
    parts.push(trow([
      { text: 'Station', shade: '2E6FA3' },
      { text: 'Effective Vol (m³)', shade: '2E6FA3', align: 'right' },
      { text: 'Target (m³)', shade: '2E6FA3', align: 'right' },
      { text: 'Variance (m³)', shade: '2E6FA3', align: 'right' },
      { text: 'Achievement', shade: '2E6FA3', align: 'right' },
      { text: 'Source', shade: '2E6FA3', align: 'center' },
    ], true));
    d.sales.stations.forEach((st, i) => {
      const achShade = st.achievementPct === null ? rowAlt(i)
        : st.achievementPct >= 100 ? 'E8F5E9'
        : st.achievementPct >= 80 ? 'FFF3CD' : 'FFE5E5';
      parts.push(trow([
        { text: st.stationName, shade: rowAlt(i) },
        { text: fmt(st.effectiveSalesVolume), align: 'right', shade: rowAlt(i) },
        { text: fmt(st.targetVolume), align: 'right', shade: rowAlt(i) },
        { text: (st.varianceM3 >= 0 ? '+' : '') + fmt(st.varianceM3), align: 'right', shade: rowAlt(i) },
        { text: pct(st.achievementPct), align: 'right', shade: achShade },
        { text: st.usingSageData ? 'Sage' : 'Returns', align: 'center', shade: rowAlt(i) },
      ]));
    });
    parts.push('</w:tbl>');
  }

  parts.push(hline());

  parts.push(heading1('4. NON-REVENUE WATER (NRW)'));
  parts.push(tblStart());
  parts.push(trow([{ text: 'Metric', shade: '1A3A5C' }, { text: 'Value', shade: '1A3A5C', align: 'right' }], true));
  const nrwRows: [string, string][] = [
    ['Total RW Abstracted', fmt(d.nrw.totalRWVolume) + ' m³'],
    ['Total CW Produced', fmt(d.nrw.totalCWVolume) + ' m³'],
    ['Total Sales Volume', fmt(d.nrw.totalSalesVolume) + ' m³'],
    ['Station Loss (Treatment)', fmt(d.nrw.stationLossVol) + ' m³  (' + pct(d.nrw.stationLossPct) + ')'],
    ['Distribution Loss', fmt(d.nrw.distributionLossVol) + ' m³  (' + pct(d.nrw.distributionLossPct) + ')'],
    ['Total NRW Loss', fmt(d.nrw.totalLossVol) + ' m³  (' + pct(d.nrw.totalLossPct) + ')'],
  ];
  nrwRows.forEach(([label, value], i) => {
    const isLoss = label.includes('Loss');
    const lossShade = isLoss && d.nrw.totalLossPct > 20 ? 'FFE5E5' : isLoss && d.nrw.totalLossPct > 10 ? 'FFF3CD' : rowAlt(i);
    parts.push(trow([{ text: label, shade: rowAlt(i) }, { text: value, align: 'right', shade: isLoss ? lossShade : rowAlt(i) }]));
  });
  parts.push('</w:tbl>');

  parts.push(hline());

  parts.push(heading1('5. CHEMICAL STOCK'));

  for (let ci = 0; ci < d.chemicals.length; ci++) {
    const chem = d.chemicals[ci];
    if (chem.stations.length === 0) continue;

    parts.push(heading2(`5.${ci + 1} ${chem.label}`));
    parts.push(tblStart());
    parts.push(trow([
      { text: 'Metric', shade: '2E6FA3' },
      { text: 'Value (kg)', shade: '2E6FA3', align: 'right' },
    ], true));
    const chemRows: [string, string][] = [
      ['Opening Balance', fmt(chem.totalOpening, 1)],
      ['Total Received', fmt(chem.totalReceived, 1)],
      ['Total Used', fmt(chem.totalUsed, 1)],
      ['Used per m\u00b3 Produced', chem.usedPerM3 !== null && chem.usedPerM3 !== undefined ? fmt(chem.usedPerM3, 2) + ' g/m\u00b3' : 'N/A'],
      ['Closing Balance', fmt(chem.totalClosingBalance, 1)],
    ];
    chemRows.forEach(([label, value], i) => {
      parts.push(trow([{ text: label, shade: rowAlt(i) }, { text: value, align: 'right', shade: rowAlt(i) }]));
    });
    parts.push('</w:tbl>');

    if (chem.stations.length > 0) {
      parts.push(tblStart());
      parts.push(trow([
        { text: 'Station', shade: '2E6FA3' },
        { text: 'Opening (kg)', shade: '2E6FA3', align: 'right' },
        { text: 'Received (kg)', shade: '2E6FA3', align: 'right' },
        { text: 'Used (kg)', shade: '2E6FA3', align: 'right' },
        { text: 'g/m\u00b3', shade: '2E6FA3', align: 'right' },
        { text: 'Closing (kg)', shade: '2E6FA3', align: 'right' },
        { text: 'Days Rem.', shade: '2E6FA3', align: 'right' },
      ], true));
      chem.stations.forEach((st, i) => {
        const drShade = st.daysRemaining !== null && st.daysRemaining <= 5 ? 'FFE5E5'
          : st.daysRemaining !== null && st.daysRemaining <= 10 ? 'FFF3CD' : rowAlt(i);
        parts.push(trow([
          { text: st.stationName, shade: rowAlt(i) },
          { text: fmt(st.opening, 1), align: 'right', shade: rowAlt(i) },
          { text: fmt(st.received, 1), align: 'right', shade: rowAlt(i) },
          { text: fmt(st.used, 1), align: 'right', shade: rowAlt(i) },
          { text: (st as any).usedPerM3 !== null && (st as any).usedPerM3 !== undefined ? fmt((st as any).usedPerM3, 2) : 'N/A', align: 'right', shade: rowAlt(i) },
          { text: fmt(st.closing, 1), align: 'right', shade: rowAlt(i) },
          { text: st.daysRemaining !== null ? String(Math.round(st.daysRemaining)) : 'N/A', align: 'right', shade: drShade },
        ]));
      });
      parts.push('</w:tbl>');
    }

    if (chem.lowStockCount > 0) {
      parts.push(para(`Low Stock Alert: ${chem.lowStockStations.map(s => `${s.stationName} (${s.daysRemaining}d)`).join(', ')}`, true));
    }
  }

  parts.push(hline());

  parts.push(heading1('6. BREAKDOWNS & MAINTENANCE'));

  if (d.breakdowns.length > 0) {
    parts.push(tblStart());
    parts.push(trow([
      { text: 'Station', shade: '1A3A5C' },
      { text: 'Component', shade: '1A3A5C' },
      { text: 'Impact', shade: '1A3A5C' },
      { text: 'Date', shade: '1A3A5C' },
      { text: 'Hrs Lost', shade: '1A3A5C', align: 'right' },
      { text: 'Status', shade: '1A3A5C', align: 'center' },
    ], true));
    d.breakdowns.forEach((b, i) => {
      parts.push(trow([
        { text: b.stationName, shade: rowAlt(i) },
        { text: b.component, shade: rowAlt(i) },
        { text: b.impact, shade: rowAlt(i) },
        { text: formatDate(b.dateReported), shade: rowAlt(i) },
        { text: b.hoursLost > 0 ? fmt(b.hoursLost, 1) : '\u2014', align: 'right', shade: b.hoursLost > 0 && b.impact === 'Stopped pumping' ? 'FFE5E5' : rowAlt(i) },
        { text: b.isResolved ? 'RESOLVED' : 'OPEN', align: 'center', shade: b.isResolved ? 'E8F5E9' : 'FFE5E5' },
      ]));
    });
    if (d.production.totalBreakdownHoursLost > 0) {
      parts.push(trow([
        { text: 'TOTAL PUMPING HRS LOST', shade: 'FFF3CD', bold: true },
        { text: '', shade: 'FFF3CD' },
        { text: 'Stopped pumping', shade: 'FFF3CD' },
        { text: '', shade: 'FFF3CD' },
        { text: fmt(d.production.totalBreakdownHoursLost, 1), align: 'right', shade: 'FFE5E5', bold: true },
        { text: '', shade: 'FFF3CD' },
      ]));
    }
    parts.push('</w:tbl>');
  } else {
    parts.push(para('No breakdowns recorded during this month.'));
  }

  parts.push(hline());

  parts.push(heading1('7. KPI SUMMARY ANALYSIS'));
  parts.push(para('The table below identifies the worst-performing station under each key performance indicator for the reporting month.'));

  const kpi = d.kpiAnalysis;
  const kpiItems: Array<{ label: string; station: string; value: string; context: string }> = [];

  if (kpi.worstNRW) {
    kpiItems.push({
      label: 'Highest NRW Rate',
      station: kpi.worstNRW.stationName,
      value: `${kpi.worstNRW.value.toFixed(1)}${kpi.worstNRW.unit}`,
      context: kpi.worstNRW.context || '',
    });
  }
  if (kpi.worstFinancialLoss) {
    kpiItems.push({
      label: 'Highest Water Loss Volume',
      station: kpi.worstFinancialLoss.stationName,
      value: `${fmt(kpi.worstFinancialLoss.value, 0)} ${kpi.worstFinancialLoss.unit}`,
      context: kpi.worstFinancialLoss.context || '',
    });
  }
  if (kpi.worstSalesAchievement) {
    kpiItems.push({
      label: 'Lowest Sales Achievement',
      station: kpi.worstSalesAchievement.stationName,
      value: `${kpi.worstSalesAchievement.value.toFixed(1)}${kpi.worstSalesAchievement.unit}`,
      context: kpi.worstSalesAchievement.context || '',
    });
  }
  if (kpi.worstEfficiency) {
    kpiItems.push({
      label: 'Lowest Production Efficiency',
      station: kpi.worstEfficiency.stationName,
      value: `${kpi.worstEfficiency.value.toFixed(1)}${kpi.worstEfficiency.unit}`,
      context: kpi.worstEfficiency.context || '',
    });
  }
  if (kpi.worstDowntime) {
    kpiItems.push({
      label: 'Highest Total Downtime',
      station: kpi.worstDowntime.stationName,
      value: `${kpi.worstDowntime.value.toFixed(1)} ${kpi.worstDowntime.unit}`,
      context: kpi.worstDowntime.context || '',
    });
  }
  if (kpi.mostBreakdowns) {
    kpiItems.push({
      label: 'Most Breakdowns Recorded',
      station: kpi.mostBreakdowns.stationName,
      value: `${kpi.mostBreakdowns.value} ${kpi.mostBreakdowns.unit}`,
      context: kpi.mostBreakdowns.context || '',
    });
  }

  if (kpiItems.length > 0) {
    parts.push(tblStart());
    parts.push(trow([
      { text: 'KPI', shade: '1A3A5C' },
      { text: 'Worst Station', shade: '1A3A5C' },
      { text: 'Value', shade: '1A3A5C', align: 'right' },
      { text: 'Context / Detail', shade: '1A3A5C' },
    ], true));
    kpiItems.forEach((item, i) => {
      parts.push(trow([
        { text: item.label, shade: rowAlt(i), bold: true },
        { text: item.station, shade: rowAlt(i) },
        { text: item.value, align: 'right', shade: rowAlt(i) },
        { text: item.context, shade: rowAlt(i) },
      ]));
    });
    parts.push('</w:tbl>');
  } else {
    parts.push(para('Insufficient data to perform KPI analysis for this month.'));
  }

  parts.push(hline());

  parts.push(heading1('8. RAW WATER'));

  const rw = d.rwDamReport || [];
  const rwStats = d.rwAgreementStats;

  if (rw.length > 0) {
    parts.push(heading2('8.1 Water Allocation & Sales by Dam'));
    parts.push(tblStart());
    parts.push(trow([
      { text: 'Dam', shade: '1A3A5C' },
      { text: 'Code', shade: '1A3A5C' },
      { text: `Allocated (ML)`, shade: '1A3A5C', align: 'right' },
      { text: `Sales (ML)`, shade: '1A3A5C', align: 'right' },
    ], true));

    let totAlloc = 0;
    let totSales = 0;
    rw.forEach((dam, i) => {
      totAlloc += dam.allocationVolume;
      totSales += dam.salesVolume;
      parts.push(trow([
        { text: dam.damName, shade: rowAlt(i) },
        { text: dam.damCode || '-', shade: rowAlt(i) },
        { text: fmt(dam.allocationVolume, 2), shade: rowAlt(i), align: 'right' },
        { text: fmt(dam.salesVolume, 2), shade: rowAlt(i), align: 'right' },
      ]));
    });

    parts.push(trow([
      { text: 'TOTAL', shade: 'E8EEF5', bold: true },
      { text: '', shade: 'E8EEF5' },
      { text: fmt(totAlloc, 2), shade: 'E8EEF5', bold: true, align: 'right' },
      { text: fmt(totSales, 2), shade: 'E8EEF5', bold: true, align: 'right' },
    ]));
    parts.push('</w:tbl>');
  } else {
    parts.push(para('No raw water allocation data available for this month.'));
  }

  if (rwStats) {
    parts.push(heading2('8.2 Agreement Statistics'));
    parts.push(tblStart());
    parts.push(trow([
      { text: 'Metric', shade: '1A3A5C' },
      { text: 'Count', shade: '1A3A5C', align: 'right' },
    ], true));
    const statsRows = [
      { label: `Active agreements in ${d.year}`, value: rwStats.totalActiveInYear },
      { label: 'Currently active agreements', value: rwStats.currentlyActive },
      { label: `Expired in ${d.monthName}`, value: rwStats.expiredInMonth },
      { label: 'Expiring next month', value: rwStats.expiringNextMonth },
    ];
    statsRows.forEach((row, i) => {
      const shade = row.label.includes('Expiring') && row.value > 0 ? 'FFF3CD' : rowAlt(i);
      parts.push(trow([
        { text: row.label, shade },
        { text: String(row.value), shade, align: 'right', bold: row.value > 0 },
      ]));
    });
    parts.push('</w:tbl>');
  }

  parts.push(hline());

  parts.push(heading1('9. OBSERVATIONS & RECOMMENDATIONS'));
  for (let i = 0; i < 5; i++) {
    parts.push(`<w:p>
      <w:pPr><w:spacing w:after="0"/>
        <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="DDDDDD"/></w:pBdr>
      </w:pPr>
      <w:r><w:t></w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>`);
  }

  parts.push(hline());

  parts.push(`<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="200" w:after="80"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="16"/><w:color w:val="888888"/></w:rPr>
      <w:t>${esc('This report was automatically generated from the Water Utilities Management System.')}</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
    <w:r><w:rPr><w:sz w:val="16"/><w:color w:val="888888"/></w:rPr>
      <w:t>${esc('Prepared by: ____________________________   Approved by: ____________________________')}</w:t>
    </w:r>
  </w:p>`);

  return parts.join('\n');
}

function buildDocx(bodyContent: string): Uint8Array {
  const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/><w:szCs w:val="20"/>
        <w:lang w:val="en-GB"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
      <w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="1A3A5C"/></w:pBdr>
    </w:pPr>
    <w:rPr><w:b/><w:color w:val="1A3A5C"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="2E6FA3"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/><w:left w:w="115" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/><w:right w:w="115" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
  </w:style>
</w:styles>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="900" w:bottom="1080" w:left="900" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const files: Record<string, string> = {
    '[Content_Types].xml': ctXml,
    '_rels/.rels': relsXml,
    'word/_rels/document.xml.rels': wordRels,
    'word/document.xml': documentXml,
    'word/styles.xml': stylesXml,
    'word/settings.xml': settingsXml,
  };

  return createZip(files);
}

function createZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const cd: Array<{ fn: Uint8Array; offset: number; crc: number; size: number }> = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const fn = enc.encode(name);
    const cb = enc.encode(content);
    const crc = crc32(cb);
    const sz = cb.length;
    const lh = new Uint8Array(30 + fn.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, sz, true);
    dv.setUint32(22, sz, true);
    dv.setUint16(26, fn.length, true);
    lh.set(fn, 30);
    cd.push({ fn, offset, crc, size: sz });
    offset += lh.length + cb.length;
    parts.push(lh);
    parts.push(cb);
  }

  const cdStart = offset;
  const cdParts: Uint8Array[] = [];
  for (const e of cd) {
    const r = new Uint8Array(46 + e.fn.length);
    const dv = new DataView(r.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.size, true);
    dv.setUint32(24, e.size, true);
    dv.setUint16(28, e.fn.length, true);
    dv.setUint32(42, e.offset, true);
    r.set(e.fn, 46);
    cdParts.push(r);
    offset += r.length;
  }

  const cdSz = offset - cdStart;
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, cd.length, true);
  edv.setUint16(10, cd.length, true);
  edv.setUint32(12, cdSz, true);
  edv.setUint32(16, cdStart, true);

  const all = [...parts, ...cdParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const res = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { res.set(p, pos); pos += p.length; }
  return res;
}

function crc32(data: Uint8Array): number {
  const t = makeTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = (c >>> 8) ^ t[(c ^ data[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeTable(): Uint32Array {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
}

export function generateMonthlyReportDocx(data: MonthlyReportData): Uint8Array {
  return buildDocx(buildContent(data));
}

export function downloadMonthlyReport(data: MonthlyReportData): void {
  const bytes = generateMonthlyReportDocx(data);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const scSafe = data.serviceCentreName.replace(/[^a-zA-Z0-9]/g, '_');
  a.href = url;
  a.download = `Monthly_Report_${data.monthName}_${data.year}_${scSafe}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
