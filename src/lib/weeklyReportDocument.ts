import type { WeeklyReportData } from './metrics/weeklyReportMetrics';

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

function formatNum(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function heading1(text: string): string {
  return `
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r><w:t>${esc(text)}</w:t></w:r>
    </w:p>`;
}

function heading2(text: string): string {
  return `
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
        <w:spacing w:before="200" w:after="80"/>
      </w:pPr>
      <w:r><w:t>${esc(text)}</w:t></w:r>
    </w:p>`;
}

function para(text: string, bold = false, color = ''): string {
  const bTag = bold ? '<w:b/>' : '';
  const colorTag = color ? `<w:color w:val="${color}"/>` : '';
  return `
    <w:p>
      <w:pPr><w:spacing w:after="80"/></w:pPr>
      <w:r>
        <w:rPr>${bTag}${colorTag}</w:rPr>
        <w:t xml:space="preserve">${esc(text)}</w:t>
      </w:r>
    </w:p>`;
}

function keyValue(label: string, value: string): string {
  return `
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(label + ': ')}</w:t></w:r>
      <w:r><w:t>${esc(value)}</w:t></w:r>
    </w:p>`;
}

function horizontalLine(): string {
  return `
    <w:p>
      <w:pPr>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/>
        </w:pBdr>
        <w:spacing w:before="120" w:after="120"/>
      </w:pPr>
    </w:p>`;
}

function tableRow(cells: Array<{ text: string; bold?: boolean; shade?: string; align?: string }>, isHeader = false): string {
  const cellsXml = cells.map(cell => {
    const shading = cell.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${cell.shade}"/>` : '';
    const justification = cell.align === 'right' ? '<w:jc w:val="right"/>' : (cell.align === 'center' ? '<w:jc w:val="center"/>' : '');
    const bold = (cell.bold || isHeader) ? '<w:b/>' : '';
    const fontSize = '<w:sz w:val="18"/><w:szCs w:val="18"/>';
    return `
      <w:tc>
        <w:tcPr>
          ${shading}
          <w:tcBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          </w:tcBorders>
        </w:tcPr>
        <w:p>
          <w:pPr>
            ${justification}
            <w:spacing w:after="0"/>
          </w:pPr>
          <w:r>
            <w:rPr>${bold}${fontSize}</w:rPr>
            <w:t xml:space="preserve">${esc(cell.text)}</w:t>
          </w:r>
        </w:p>
      </w:tc>`;
  }).join('');
  return `<w:tr>${cellsXml}</w:tr>`;
}

function tableStart(): string {
  return `<w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:tblBorders>
          <w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>
          <w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/>
        </w:tblBorders>
      </w:tblPr>`;
}

function buildProductionSection(data: WeeklyReportData): string {
  const p = data.production;
  const parts: string[] = [];

  parts.push(heading1('2. PRODUCTION OVERVIEW'));
  parts.push(`
    ${tableStart()}
      ${tableRow([
        { text: 'Metric', shade: '1A3A5C', bold: true },
        { text: 'Value', shade: '1A3A5C', bold: true, align: 'right' },
      ], true)}
      ${tableRow([
        { text: 'Total CW Volume Produced', shade: 'EBF5FB' },
        { text: formatNum(p.totalCWVolume, 0) + ' m\u00B3', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Total RW Volume Abstracted', shade: 'FFFFFF' },
        { text: formatNum(p.totalRWVolume, 0) + ' m\u00B3', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Total CW Hours Run', shade: 'EBF5FB' },
        { text: formatNum(p.totalCWHours, 1) + ' hrs', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Total RW Hours Run', shade: 'FFFFFF' },
        { text: formatNum(p.totalRWHours, 1) + ' hrs', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Average CW Pump Rate', shade: 'EBF5FB' },
        { text: p.avgCWPumpRate !== null ? formatNum(p.avgCWPumpRate, 1) + ' m\u00B3/hr' : 'N/A', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Average RW Pump Rate', shade: 'FFFFFF' },
        { text: p.avgRWPumpRate !== null ? formatNum(p.avgRWPumpRate, 1) + ' m\u00B3/hr' : 'N/A', align: 'right' },
      ])}
      ${tableRow([
        { text: 'CW Weekly Target', shade: 'EBF5FB' },
        { text: p.cwWeeklyTarget > 0 ? formatNum(p.cwWeeklyTarget, 0) + ' m\u00B3' : 'Not Set', align: 'right' },
      ])}
      ${tableRow([
        { text: 'CW Performance vs Weekly Target', shade: 'FFFFFF' },
        { text: p.cwPerformancePct !== null ? formatNum(p.cwPerformancePct, 1) + '%' : 'N/A', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Load Shedding Hours', shade: 'EBF5FB' },
        { text: formatNum(p.totalLoadShedding, 1) + ' hrs', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Other Downtime Hours', shade: 'FFFFFF' },
        { text: formatNum(p.totalOtherDowntime, 1) + ' hrs', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Total Downtime', shade: 'EBF5FB' },
        { text: formatNum(p.totalDowntime, 1) + ' hrs', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Average Production Efficiency', shade: 'FFFFFF' },
        { text: formatNum(p.avgEfficiency, 1) + '%', align: 'right' },
      ])}
      ${tableRow([
        { text: 'New Connections', shade: 'EBF5FB' },
        { text: String(p.totalNewConnections), align: 'right' },
      ])}
      ${tableRow([
        { text: 'CW Production YTD', shade: 'FFFFFF' },
        { text: formatNum(p.totalCWVolumeYTD, 0) + ' m\u00B3', align: 'right' },
      ])}
      ${tableRow([
        { text: 'Pumping Hours Lost (Breakdowns)', shade: 'EBF5FB' },
        { text: p.totalBreakdownHoursLost > 0 ? formatNum(p.totalBreakdownHoursLost, 1) + ' hrs' : '\u2014', align: 'right' },
      ])}
    </w:tbl>`);

  if (p.stations.length > 0) {
    parts.push(heading2('2.1 Station-Level Production'));
    parts.push(`
      ${tableStart()}
        ${tableRow([
          { text: 'Station', shade: '2E6FA3', bold: true },
          { text: 'Type', shade: '2E6FA3', bold: true },
          { text: 'CW Vol (m\u00B3)', shade: '2E6FA3', bold: true, align: 'right' },
          { text: 'CW YTD (m\u00B3)', shade: '2E6FA3', bold: true, align: 'right' },
          { text: 'CW Hrs', shade: '2E6FA3', bold: true, align: 'right' },
          { text: 'Downtime', shade: '2E6FA3', bold: true, align: 'right' },
          { text: 'Eff. (%)', shade: '2E6FA3', bold: true, align: 'right' },
        ], true)}
        ${p.stations.map((st, i) => tableRow([
          { text: st.stationName, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: st.stationType, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.cwVolume, 0), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.cwVolumeYTD, 0), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.cwHours, 1), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.totalDowntime, 1), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.efficiency, 1), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        ])).join('')}
      </w:tbl>`);
  }

  return parts.join('\n');
}

function buildCapacitySection(data: WeeklyReportData): string {
  const cap = data.capacityUtilization;
  const parts: string[] = [];

  parts.push(horizontalLine());
  parts.push(heading1('3. CAPACITY UTILIZATION'));

  parts.push(heading2('3.1 RW Pumping Capacity (Full Treatment Stations)'));
  const ftStations = cap.stations.filter(s => s.stationType === 'Full Treatment');

  parts.push(`
    ${tableStart()}
      ${tableRow([
        { text: 'Station', shade: '1A3A5C', bold: true },
        { text: 'Installed (m\u00B3/hr)', shade: '1A3A5C', bold: true, align: 'right' },
        { text: 'Weekly RW (m\u00B3/hr)', shade: '1A3A5C', bold: true, align: 'right' },
        { text: 'YTD Avg RW (m\u00B3/hr)', shade: '1A3A5C', bold: true, align: 'right' },
      ], true)}
      ${ftStations.map((st, i) => tableRow([
        { text: st.stationName, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        { text: st.installedCapacity > 0 ? formatNum(st.installedCapacity, 1) : '-', align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        { text: st.weeklyRWCapacity !== null ? formatNum(st.weeklyRWCapacity, 1) : '-', align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        { text: st.ytdRWCapacity !== null ? formatNum(st.ytdRWCapacity, 1) : '-', align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
      ])).join('')}
      ${tableRow([
        { text: 'Total / Avg', shade: 'D6EAF8', bold: true },
        { text: cap.rwInstalledTotal > 0 ? formatNum(cap.rwInstalledTotal, 1) : '-', align: 'right', shade: 'D6EAF8', bold: true },
        { text: cap.rwWeeklyActualTotal !== null ? formatNum(cap.rwWeeklyActualTotal, 1) : '-', align: 'right', shade: 'D6EAF8', bold: true },
        { text: cap.rwYtdAvgTotal !== null ? formatNum(cap.rwYtdAvgTotal, 1) : '-', align: 'right', shade: 'D6EAF8', bold: true },
      ])}
    </w:tbl>`);

  parts.push(heading2('3.2 CW Pumping Capacity (All Stations)'));
  parts.push(`
    ${tableStart()}
      ${tableRow([
        { text: 'Station', shade: '1A3A5C', bold: true },
        { text: 'Type', shade: '1A3A5C', bold: true },
        { text: 'Installed (m\u00B3/hr)', shade: '1A3A5C', bold: true, align: 'right' },
        { text: 'Weekly CW (m\u00B3/hr)', shade: '1A3A5C', bold: true, align: 'right' },
        { text: 'YTD Avg CW (m\u00B3/hr)', shade: '1A3A5C', bold: true, align: 'right' },
      ], true)}
      ${cap.stations.map((st, i) => tableRow([
        { text: st.stationName, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        { text: st.stationType, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        { text: st.installedCapacity > 0 ? formatNum(st.installedCapacity, 1) : '-', align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        { text: st.weeklyCWCapacity !== null ? formatNum(st.weeklyCWCapacity, 1) : '-', align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        { text: st.ytdCWCapacity !== null ? formatNum(st.ytdCWCapacity, 1) : '-', align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
      ])).join('')}
      ${tableRow([
        { text: 'Total / Avg', shade: 'D6EAF8', bold: true },
        { text: '', shade: 'D6EAF8' },
        { text: cap.cwInstalledTotal > 0 ? formatNum(cap.cwInstalledTotal, 1) : '-', align: 'right', shade: 'D6EAF8', bold: true },
        { text: cap.cwWeeklyActualTotal !== null ? formatNum(cap.cwWeeklyActualTotal, 1) : '-', align: 'right', shade: 'D6EAF8', bold: true },
        { text: cap.cwYtdAvgTotal !== null ? formatNum(cap.cwYtdAvgTotal, 1) : '-', align: 'right', shade: 'D6EAF8', bold: true },
      ])}
    </w:tbl>`);

  return parts.join('\n');
}

function buildPowerSupplySection(data: WeeklyReportData): string {
  const ps = data.powerSupply;
  const parts: string[] = [];

  parts.push(horizontalLine());
  parts.push(heading1('4. POWER SUPPLY & HOURS'));

  parts.push(`
    ${tableStart()}
      ${tableRow([
        { text: 'Station', shade: '1A3A5C', bold: true },
        { text: 'Required Hours', shade: '1A3A5C', bold: true, align: 'right' },
        { text: 'Actual Hours Run', shade: '1A3A5C', bold: true, align: 'right' },
        { text: 'Power Availability (%)', shade: '1A3A5C', bold: true, align: 'right' },
      ], true)}
      ${ps.stations.map((st, i) => {
        const shade = st.powerAvailabilityPct < 50 ? 'FFE5E5' : (i % 2 === 0 ? 'EBF5FB' : 'FFFFFF');
        return tableRow([
          { text: st.stationName, shade },
          { text: formatNum(st.requiredHours, 1), align: 'right', shade },
          { text: formatNum(st.actualHoursRun, 1), align: 'right', shade },
          { text: formatNum(st.powerAvailabilityPct, 1) + '%', align: 'right', shade },
        ]);
      }).join('')}
      ${tableRow([
        { text: 'TOTAL', shade: 'D6EAF8', bold: true },
        { text: formatNum(ps.totalRequiredHours, 1), align: 'right', shade: 'D6EAF8', bold: true },
        { text: formatNum(ps.totalActualHours, 1), align: 'right', shade: 'D6EAF8', bold: true },
        { text: formatNum(ps.overallAvailabilityPct, 1) + '%', align: 'right', shade: 'D6EAF8', bold: true },
      ])}
    </w:tbl>`);

  return parts.join('\n');
}

function buildConnectionsSection(data: WeeklyReportData): string {
  const conn = data.connections;
  const parts: string[] = [];

  parts.push(horizontalLine());
  parts.push(heading1('5. CONNECTIONS'));

  parts.push(`
    ${tableStart()}
      ${tableRow([
        { text: 'Metric', shade: '1A3A5C', bold: true },
        { text: 'Value', shade: '1A3A5C', bold: true, align: 'right' },
      ], true)}
      ${tableRow([
        { text: 'Total Current Connections', shade: 'EBF5FB' },
        { text: formatNum(conn.totalCurrentConnections, 0), align: 'right' },
      ])}
      ${tableRow([
        { text: 'New Connections This Week', shade: 'FFFFFF' },
        { text: formatNum(conn.totalNewThisWeek, 0), align: 'right' },
      ])}
      ${tableRow([
        { text: 'New Total Connections', shade: 'EBF5FB' },
        { text: formatNum(conn.totalNewTotal, 0), align: 'right' },
      ])}
      ${tableRow([
        { text: 'Year-to-Date New Connections', shade: 'FFFFFF' },
        { text: formatNum(conn.totalYTDNew, 0), align: 'right' },
      ])}
    </w:tbl>`);

  const stationsWithNew = conn.stations.filter(s => s.newConnectionsThisWeek > 0);
  if (stationsWithNew.length > 0) {
    parts.push(heading2('5.1 Stations with New Connections'));
    parts.push(`
      ${tableStart()}
        ${tableRow([
          { text: 'Station', shade: '2E6FA3', bold: true },
          { text: 'Current', shade: '2E6FA3', bold: true, align: 'right' },
          { text: 'New (Week)', shade: '2E6FA3', bold: true, align: 'right' },
          { text: 'New Total', shade: '2E6FA3', bold: true, align: 'right' },
          { text: 'YTD New', shade: '2E6FA3', bold: true, align: 'right' },
        ], true)}
        ${stationsWithNew.map((st, i) => tableRow([
          { text: st.stationName, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.currentConnections, 0), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.newConnectionsThisWeek, 0), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.newTotal, 0), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
          { text: formatNum(st.ytdNewConnections, 0), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
        ])).join('')}
      </w:tbl>`);
  } else {
    parts.push(para('No new connections recorded this week.'));
  }

  return parts.join('\n');
}

function buildDowntimeSection(data: WeeklyReportData): string {
  const parts: string[] = [];

  parts.push(horizontalLine());
  parts.push(heading1('6. DOWNTIME ANALYSIS'));

  const highDowntimeStations = data.production.stations
    .filter(s => s.totalDowntime > 0)
    .sort((a, b) => b.totalDowntime - a.totalDowntime);

  if (highDowntimeStations.length > 0) {
    parts.push(`
      ${tableStart()}
        ${tableRow([
          { text: 'Station', shade: '1A3A5C', bold: true },
          { text: 'Load Shedding (hrs)', shade: '1A3A5C', bold: true, align: 'right' },
          { text: 'Other Downtime (hrs)', shade: '1A3A5C', bold: true, align: 'right' },
          { text: 'Total (hrs)', shade: '1A3A5C', bold: true, align: 'right' },
          { text: 'Status', shade: '1A3A5C', bold: true, align: 'center' },
        ], true)}
        ${highDowntimeStations.map((st, i) => {
          const statusLabel = st.totalDowntime > 48 ? 'CRITICAL' : st.totalDowntime > 24 ? 'WARNING' : 'NORMAL';
          const statusShade = st.totalDowntime > 48 ? 'FFE5E5' : st.totalDowntime > 24 ? 'FFF3CD' : 'E8F5E9';
          return tableRow([
            { text: st.stationName, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: formatNum(st.loadSheddingHours, 1), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: formatNum(st.otherDowntimeHours, 1), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: formatNum(st.totalDowntime, 1), align: 'right', shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: statusLabel, align: 'center', shade: statusShade },
          ]);
        }).join('')}
      </w:tbl>`);
  } else {
    parts.push(para('No downtime recorded during this period.'));
  }

  return parts.join('\n');
}

function buildBreakdownsSection(data: WeeklyReportData): string {
  const parts: string[] = [];

  parts.push(horizontalLine());
  parts.push(heading1('7. BREAKDOWNS'));

  if (data.breakdowns.length > 0) {
    parts.push(`
      ${tableStart()}
        ${tableRow([
          { text: 'Station', shade: '1A3A5C', bold: true },
          { text: 'Component', shade: '1A3A5C', bold: true },
          { text: 'Impact', shade: '1A3A5C', bold: true },
          { text: 'Date Reported', shade: '1A3A5C', bold: true },
          { text: 'Hrs Lost', shade: '1A3A5C', bold: true, align: 'right' },
          { text: 'Status', shade: '1A3A5C', bold: true, align: 'center' },
        ], true)}
        ${data.breakdowns.map((b, i) => {
          const statusLabel = b.isResolved ? 'RESOLVED' : 'OPEN';
          const statusShade = b.isResolved ? 'E8F5E9' : 'FFE5E5';
          return tableRow([
            { text: b.stationName, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: b.component, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: b.impact, shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: formatDate(b.dateReported), shade: i % 2 === 0 ? 'EBF5FB' : 'FFFFFF' },
            { text: b.hoursLost > 0 ? formatNum(b.hoursLost, 1) : '\u2014', align: 'right', shade: b.hoursLost > 0 && b.impact === 'Stopped pumping' ? 'FFE5E5' : (i % 2 === 0 ? 'EBF5FB' : 'FFFFFF') },
            { text: statusLabel, align: 'center', shade: statusShade },
          ]);
        }).join('')}
      </w:tbl>`);
  } else {
    parts.push(para('No breakdowns reported during this period.'));
  }

  return parts.join('\n');
}

function buildChemicalsSection(data: WeeklyReportData): string {
  const parts: string[] = [];

  parts.push(horizontalLine());
  parts.push(heading1('8. CHEMICAL STOCK STATUS'));

  for (const chem of data.chemicals) {
    parts.push(heading2('8.' + (data.chemicals.indexOf(chem) + 1) + ' ' + chem.label));
    parts.push(`
      ${tableStart()}
        ${tableRow([
          { text: 'Total Used (kg)', shade: '2E6FA3', bold: true },
          { text: 'Current Balance (kg)', shade: '2E6FA3', bold: true },
          { text: 'Low Stock Stations', shade: '2E6FA3', bold: true, align: 'center' },
        ], true)}
        ${tableRow([
          { text: formatNum(chem.totalUsed, 1), shade: 'EBF5FB' },
          { text: formatNum(chem.totalBalance, 1), shade: 'EBF5FB' },
          { text: String(chem.lowStockCount), align: 'center', shade: chem.lowStockCount > 0 ? 'FFE5E5' : 'E8F5E9' },
        ])}
      </w:tbl>`);

    if (chem.lowStockStations.length > 0) {
      parts.push(para('Low Stock Alerts:', true, 'C0392B'));
      for (const st of chem.lowStockStations) {
        parts.push(para(`  \u2022 ${st.stationName}: ${st.daysRemaining} day${st.daysRemaining !== 1 ? 's' : ''} remaining`));
      }
    }
  }

  return parts.join('\n');
}

function buildDocumentContent(data: WeeklyReportData): string {
  const reportTypeLbl = data.reportType === 'friday' ? 'Friday' : 'Tuesday';
  const reportTitle = `WEEKLY OPERATIONS REPORT \u2014 ${reportTypeLbl.toUpperCase()} REPORT`;
  const subTitle = `Week ${data.weekNumber}, ${data.year} | ${data.serviceCentreName}`;
  const periodStr = `${formatDate(data.periodStart)} \u2013 ${formatDate(data.periodEnd)}`;

  const parts: string[] = [];

  parts.push(`
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
          <w:szCs w:val="32"/>
          <w:color w:val="1A3A5C"/>
        </w:rPr>
        <w:t>${esc(reportTitle)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="24"/>
          <w:szCs w:val="24"/>
          <w:color w:val="2E6FA3"/>
        </w:rPr>
        <w:t>${esc(subTitle)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="40"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="20"/>
          <w:szCs w:val="20"/>
          <w:color w:val="555555"/>
        </w:rPr>
        <w:t>${esc('Reporting Period: ' + periodStr)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="200"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:szCs w:val="18"/>
          <w:color w:val="888888"/>
        </w:rPr>
        <w:t>${esc('Generated: ' + new Date(data.generatedAt).toLocaleString('en-GB'))}</w:t>
      </w:r>
    </w:p>`);

  parts.push(horizontalLine());

  parts.push(heading1('1. SUMMARY'));
  parts.push(keyValue('Service Centre', data.serviceCentreName));
  parts.push(keyValue('Report Period', periodStr));
  parts.push(keyValue('Report Type', `${reportTypeLbl} Weekly Report`));
  parts.push(keyValue('Week Number', `Week ${data.weekNumber} of ${data.year}`));
  parts.push(keyValue('Data Completeness', `${data.totalActualLogs} of ${data.totalExpectedLogs} station-day logs (${data.completionPct}%)`));
  parts.push(keyValue('Active Stations', `${data.production.stationCount}`));
  parts.push(keyValue('Total Breakdowns Reported', `${data.breakdowns.length}`));

  parts.push(buildProductionSection(data));
  parts.push(buildCapacitySection(data));
  parts.push(buildPowerSupplySection(data));
  parts.push(buildConnectionsSection(data));
  parts.push(buildDowntimeSection(data));
  parts.push(buildBreakdownsSection(data));
  parts.push(buildChemicalsSection(data));

  parts.push(horizontalLine());
  parts.push(heading1('9. NOTES & OBSERVATIONS'));
  parts.push(para('Please add any operational notes, incidents, or observations for this week below:'));
  for (let i = 0; i < 4; i++) {
    parts.push(`
      <w:p>
        <w:pPr>
          <w:spacing w:after="0"/>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="4" w:space="1" w:color="DDDDDD"/>
          </w:pBdr>
        </w:pPr>
        <w:r><w:t></w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`);
  }

  parts.push(horizontalLine());
  parts.push(`
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="240" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="16"/>
          <w:color w:val="888888"/>
        </w:rPr>
        <w:t>${esc('This report was automatically generated from the Water Utilities Management System.')}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="0"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="16"/>
          <w:color w:val="888888"/>
        </w:rPr>
        <w:t>${esc('Prepared by: ____________________________   Date: ____________________________')}</w:t>
      </w:r>
    </w:p>`);

  return parts.join('\n');
}

function buildDocx(bodyContent: string): Uint8Array {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="20"/>
        <w:szCs w:val="20"/>
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
      <w:pBdr>
        <w:bottom w:val="single" w:sz="8" w:space="4" w:color="1A3A5C"/>
      </w:pBdr>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="1A3A5C"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="2E6FA3"/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
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
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="115" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="115" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
  </w:style>
</w:styles>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 w15 wp14">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const files: Record<string, string> = {
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': relsXml,
    'word/_rels/document.xml.rels': wordRelsXml,
    'word/document.xml': documentXml,
    'word/styles.xml': stylesXml,
    'word/settings.xml': settingsXml,
  };

  return createZip(files);
}

function createZip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDirectory: Array<{
    fileName: Uint8Array;
    offset: number;
    crc32: number;
    size: number;
    compressedSize: number;
  }> = [];

  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const fileNameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const crc = crc32(contentBytes);
    const size = contentBytes.length;

    const localHeader = new Uint8Array(30 + fileNameBytes.length);
    const dv = new DataView(localHeader.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, fileNameBytes.length, true);
    dv.setUint16(28, 0, true);
    localHeader.set(fileNameBytes, 30);

    centralDirectory.push({ fileName: fileNameBytes, offset, crc32: crc, size, compressedSize: size });
    offset += localHeader.length + contentBytes.length;

    parts.push(localHeader);
    parts.push(contentBytes);
  }

  const centralDirStart = offset;
  const centralDirParts: Uint8Array[] = [];

  for (const entry of centralDirectory) {
    const cdRecord = new Uint8Array(46 + entry.fileName.length);
    const dv = new DataView(cdRecord.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0, true);
    dv.setUint32(16, entry.crc32, true);
    dv.setUint32(20, entry.compressedSize, true);
    dv.setUint32(24, entry.size, true);
    dv.setUint16(28, entry.fileName.length, true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(38, 0, true);
    dv.setUint32(42, entry.offset, true);
    cdRecord.set(entry.fileName, 46);
    centralDirParts.push(cdRecord);
    offset += cdRecord.length;
  }

  const centralDirSize = offset - centralDirStart;

  const eocd = new Uint8Array(22);
  const eocddv = new DataView(eocd.buffer);
  eocddv.setUint32(0, 0x06054b50, true);
  eocddv.setUint16(4, 0, true);
  eocddv.setUint16(6, 0, true);
  eocddv.setUint16(8, centralDirectory.length, true);
  eocddv.setUint16(10, centralDirectory.length, true);
  eocddv.setUint32(12, centralDirSize, true);
  eocddv.setUint32(16, centralDirStart, true);
  eocddv.setUint16(20, 0, true);

  const allParts = [...parts, ...centralDirParts, eocd];
  const totalSize = allParts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

function crc32(data: Uint8Array): number {
  const table = makeCRC32Table();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRC32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

export function generateWeeklyReportDocx(data: WeeklyReportData): Uint8Array {
  const bodyContent = buildDocumentContent(data);
  return buildDocx(bodyContent);
}

export function downloadWeeklyReport(data: WeeklyReportData): void {
  const bytes = generateWeeklyReportDocx(data);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const reportType = data.reportType === 'friday' ? 'Fri' : 'Tue';
  const scSafe = data.serviceCentreName.replace(/[^a-zA-Z0-9]/g, '_');
  a.href = url;
  a.download = `Weekly_Report_W${data.weekNumber}_${data.year}_${reportType}_${scSafe}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
