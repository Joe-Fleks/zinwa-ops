import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import type { WeeklyReportData } from '../../lib/metrics/weeklyReportMetrics';
import type { MonthlyReportData } from '../../lib/metrics/monthlyReportMetrics';

interface ReportViewerProps {
  reportType: 'weekly' | 'monthly';
  reportData: WeeklyReportData | MonthlyReportData;
  title: string;
  subtitle: string;
  onBack: () => void;
  onDownload: () => void;
  onRefresh?: () => Promise<void>;
  isDownloading?: boolean;
  isRefreshing?: boolean;
}

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pct(n: number | null | undefined): string {
  return n !== null && n !== undefined ? fmt(n, 1) + '%' : 'N/A';
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const HDR = 'bg-[#1A3A5C] text-white font-semibold text-xs px-3 py-2';
const HDR2 = 'bg-[#2E6FA3] text-white font-semibold text-xs px-3 py-2';
const TD = 'text-xs px-3 py-2 border-b border-gray-100';
const TR_ALT = (i: number) => i % 2 === 0 ? 'bg-[#EBF5FB]' : 'bg-white';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-[#1A3A5C] mt-6 mb-2 pb-1 border-b-2 border-[#1A3A5C] uppercase tracking-wide">
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-[#2E6FA3] mt-4 mb-1.5 uppercase tracking-wide">
      {children}
    </h3>
  );
}

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="font-semibold text-gray-700 w-52 flex-shrink-0">{label}:</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

function WeeklyReportView({ data }: { data: WeeklyReportData }) {
  const reportTypeLbl = data.reportType === 'friday' ? 'Friday (End of Week)' : 'Tuesday (Mid-week)';

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <KVRow label="Report Type" value={reportTypeLbl} />
        <KVRow label="Period" value={`${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`} />
        <KVRow label="Service Centre" value={data.serviceCentreName} />
        <KVRow label="Week" value={`Week ${data.weekNumber}, ${data.year}`} />
        <KVRow label="Data Coverage" value={`${data.totalActualLogs} of ${data.totalExpectedLogs} logs (${data.completionPct}%)`} />
        <KVRow label="Generated" value={new Date(data.generatedAt).toLocaleString('en-GB')} />
      </div>

      <SectionTitle>1. Production Overview</SectionTitle>
      <table className="w-full border border-gray-200 rounded text-left mb-3">
        <tbody>
          {[
            ['Total CW Volume', fmt(data.production.totalCWVolume) + ' m³'],
            ['Total CW Volume YTD', fmt(data.production.totalCWVolumeYTD) + ' m³'],
            ['CW Weekly Target', fmt(data.production.cwWeeklyTarget) + ' m³'],
            ['CW Performance', pct(data.production.cwPerformancePct)],
            ['Total RW Volume', fmt(data.production.totalRWVolume) + ' m³'],
            ['CW Hours Run', fmt(data.production.totalCWHours, 1) + ' hrs'],
            ['RW Hours Run', fmt(data.production.totalRWHours, 1) + ' hrs'],
            ['Avg CW Pump Rate', data.production.avgCWPumpRate !== null ? fmt(data.production.avgCWPumpRate, 1) + ' m³/hr' : 'N/A'],
            ['Avg Efficiency', pct(data.production.avgEfficiency)],
            ['Load Shedding', fmt(data.production.totalLoadShedding, 1) + ' hrs'],
            ['Other Downtime', fmt(data.production.totalOtherDowntime, 1) + ' hrs'],
            ['Breakdown Hours Lost', fmt(data.production.totalBreakdownHoursLost, 1) + ' hrs'],
            ['New Connections', String(data.production.totalNewConnections)],
          ].map(([label, value], i) => (
            <tr key={label} className={TR_ALT(i)}>
              <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
              <td className={TD + ' text-gray-800 text-right'}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.production.stations.length > 0 && (
        <>
          <SubTitle>Station Production Detail</SubTitle>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded text-left mb-3">
              <thead>
                <tr>
                  {['Station', 'Type', 'CW Vol (m³)', 'CW Hrs', 'Efficiency', 'Downtime (hrs)', 'New Conn.'].map(h => (
                    <th key={h} className={HDR2}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.production.stations.map((st, i) => (
                  <tr key={st.stationId} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD}>{st.stationType}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwVolume)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwHours, 1)}</td>
                    <td className={TD + ' text-right'}>{pct(st.efficiency)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.totalDowntime, 1)}</td>
                    <td className={TD + ' text-right'}>{st.newConnections}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionTitle>2. Capacity Utilization</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[
          ['RW Installed Capacity', fmt(data.capacityUtilization.rwInstalledTotal) + ' m³/hr'],
          ['RW Weekly Actual', data.capacityUtilization.rwWeeklyActualTotal !== null ? fmt(data.capacityUtilization.rwWeeklyActualTotal, 1) + ' m³/hr' : 'N/A'],
          ['CW Installed Capacity', fmt(data.capacityUtilization.cwInstalledTotal) + ' m³/hr'],
          ['CW Weekly Actual', data.capacityUtilization.cwWeeklyActualTotal !== null ? fmt(data.capacityUtilization.cwWeeklyActualTotal, 1) + ' m³/hr' : 'N/A'],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <SectionTitle>3. Power Supply</SectionTitle>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[
          ['Required Hours', fmt(data.powerSupply.totalRequiredHours, 0) + ' hrs'],
          ['Actual Hours', fmt(data.powerSupply.totalActualHours, 0) + ' hrs'],
          ['Availability', pct(data.powerSupply.overallAvailabilityPct)],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <SectionTitle>4. Connections</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[
          ['Total Connections', fmt(data.connections.totalCurrentConnections)],
          ['New This Week', String(data.connections.totalNewThisWeek)],
          ['New Total', String(data.connections.totalNewTotal)],
          ['YTD New Connections', String(data.connections.totalYTDNew)],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <SectionTitle>5. Breakdowns</SectionTitle>
      {data.breakdowns.length > 0 ? (
        <div className="overflow-x-auto mb-3">
          <table className="w-full border border-gray-200 rounded text-left">
            <thead>
              <tr>
                {['Station', 'Component', 'Impact', 'Date', 'Hrs Lost', 'Status'].map(h => (
                  <th key={h} className={HDR}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.breakdowns.map((b, i) => (
                <tr key={i} className={TR_ALT(i)}>
                  <td className={TD + ' font-medium'}>{b.stationName}</td>
                  <td className={TD}>{b.component}</td>
                  <td className={TD}>{b.impact}</td>
                  <td className={TD}>{fmtDate(b.dateReported)}</td>
                  <td className={TD + ' text-right'}>{b.hoursLost > 0 ? fmt(b.hoursLost, 1) : '—'}</td>
                  <td className={TD + ' text-center'}>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${b.isResolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {b.isResolved ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No breakdowns reported during this period.</p>
      )}

      <SectionTitle>6. Downtime by Station</SectionTitle>
      {data.production.stations.filter(s => s.totalDowntime > 0).length > 0 ? (
        <div className="overflow-x-auto mb-3">
          <table className="w-full border border-gray-200 rounded text-left">
            <thead>
              <tr>
                {['Station', 'Load Shedding (hrs)', 'Other Downtime (hrs)', 'Total (hrs)'].map(h => (
                  <th key={h} className={HDR2}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.production.stations.filter(s => s.totalDowntime > 0).map((st, i) => (
                <tr key={st.stationId} className={TR_ALT(i)}>
                  <td className={TD + ' font-medium'}>{st.stationName}</td>
                  <td className={TD + ' text-right'}>{fmt(st.loadSheddingHours, 1)}</td>
                  <td className={TD + ' text-right'}>{fmt(st.otherDowntimeHours, 1)}</td>
                  <td className={TD + ' text-right font-semibold'}>{fmt(st.totalDowntime, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No downtime recorded during this period.</p>
      )}

      <SectionTitle>7. Chemical Stock Status</SectionTitle>
      {data.chemicals.map((chem, ci) => (
        <div key={chem.chemicalType} className="mb-4">
          <SubTitle>{ci + 1}. {chem.label}</SubTitle>
          <table className="w-full border border-gray-200 rounded text-left mb-2">
            <thead>
              <tr>
                <th className={HDR2}>Total Used (kg)</th>
                <th className={HDR2 + ' text-right'}>Used per m³ (g/m³)</th>
                <th className={HDR2 + ' text-right'}>Current Balance (kg)</th>
                <th className={HDR2 + ' text-center'}>Low Stock Stations</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-[#EBF5FB]">
                <td className={TD}>{fmt(chem.totalUsed, 1)}</td>
                <td className={TD + ' text-right'}>{chem.usedPerM3 !== null && chem.usedPerM3 !== undefined ? fmt(chem.usedPerM3, 2) : 'N/A'}</td>
                <td className={TD + ' text-right'}>{fmt(chem.totalBalance, 1)}</td>
                <td className={`${TD} text-center`}>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${chem.lowStockCount > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {chem.lowStockCount}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          {chem.lowStockStations.length > 0 && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              <span className="font-semibold">Low Stock: </span>
              {chem.lowStockStations.map(s => `${s.stationName} (${s.daysRemaining}d)`).join(', ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MonthlyReportView({ data }: { data: MonthlyReportData }) {
  return (
    <div>
      <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
        <KVRow label="Service Centre" value={data.serviceCentreName} />
        <KVRow label="Reporting Month" value={`${data.monthName} ${data.year}`} />
        <KVRow label="Active Stations" value={String(data.production.stationCount)} />
        <KVRow label="Data Completeness" value={`${data.totalActualLogs} of ${data.totalExpectedLogs} logs (${data.completionPct}%)`} />
        <KVRow label="Generated" value={new Date(data.generatedAt).toLocaleString('en-GB')} />
      </div>

      <SectionTitle>1. Executive Summary</SectionTitle>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          ['Total CW Volume', fmt(data.production.totalCWVolume) + ' m³'],
          ['Total Sales Volume', fmt(data.sales.totalEffectiveSalesVolume) + ' m³'],
          ['Sales Achievement', pct(data.sales.overallAchievementPct)],
          ['Total NRW Losses', fmt(data.nrw.totalLossVol) + ' m³ (' + pct(data.nrw.totalLossPct) + ')'],
          ['New Connections', String(data.production.totalNewConnections)],
          ['New Connections YTD', String(data.production.totalNewConnectionsYTD)],
          ['Total Breakdowns', String(data.breakdowns.length)],
          ['Breakdown Hrs Lost', fmt(data.production.totalBreakdownHoursLost, 1) + ' hrs'],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <SectionTitle>2. Production</SectionTitle>
      <table className="w-full border border-gray-200 rounded text-left mb-3">
        <tbody>
          {[
            ['Total CW Volume', fmt(data.production.totalCWVolume) + ' m³'],
            ['Total RW Volume', fmt(data.production.totalRWVolume) + ' m³'],
            ['Total CW Hours Run', fmt(data.production.totalCWHours, 1) + ' hrs'],
            ['Total RW Hours Run', fmt(data.production.totalRWHours, 1) + ' hrs'],
            ['Avg CW Pump Rate', data.production.avgCWPumpRate !== null ? fmt(data.production.avgCWPumpRate, 1) + ' m³/hr' : 'N/A'],
            ['Average Efficiency', pct(data.production.avgEfficiency)],
            ['Load Shedding Hours', fmt(data.production.totalLoadShedding, 1) + ' hrs'],
            ['Other Downtime Hours', fmt(data.production.totalOtherDowntime, 1) + ' hrs'],
            ['Total Downtime', fmt(data.production.totalDowntime, 1) + ' hrs'],
            ['New Connections', String(data.production.totalNewConnections)],
            ['New Connections YTD', String(data.production.totalNewConnectionsYTD)],
            ['Breakdown Hours Lost', fmt(data.production.totalBreakdownHoursLost, 1) + ' hrs'],
          ].map(([label, value], i) => (
            <tr key={label} className={TR_ALT(i)}>
              <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
              <td className={TD + ' text-right'}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.production.stations.length > 0 && (
        <>
          <SubTitle>Station Production Detail</SubTitle>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Station', 'Type', 'CW Vol (m³)', 'CW Hrs', 'Efficiency', 'Downtime (hrs)', 'New Conn.'].map(h => (
                    <th key={h} className={HDR2}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.production.stations.map((st, i) => (
                  <tr key={st.stationId} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD}>{st.stationType}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwVolume)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwHours, 1)}</td>
                    <td className={TD + ' text-right'}>{pct(st.efficiency)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.totalDowntime, 1)}</td>
                    <td className={TD + ' text-right'}>{st.newConnections}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionTitle>3. Sales Performance</SectionTitle>
      <table className="w-full border border-gray-200 rounded text-left mb-3">
        <tbody>
          {[
            ['Total Sales Volume', fmt(data.sales.totalEffectiveSalesVolume) + ' m³'],
            ['Total Target', fmt(data.sales.totalTargetVolume) + ' m³'],
            ['Variance', (data.sales.overallVarianceM3 >= 0 ? '+' : '') + fmt(data.sales.overallVarianceM3) + ' m³'],
            ['Achievement', pct(data.sales.overallAchievementPct)],
          ].map(([label, value], i) => (
            <tr key={label} className={TR_ALT(i)}>
              <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
              <td className={TD + ' text-right'}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.sales.stations.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full border border-gray-200 rounded text-left">
            <thead>
              <tr>
                {['Station', 'Sales Vol (m³)', 'Target (m³)', 'Variance (m³)', 'Achievement', 'Source'].map(h => (
                  <th key={h} className={HDR2}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sales.stations.map((st, i) => {
                const achShade = st.achievementPct === null ? TR_ALT(i)
                  : st.achievementPct >= 100 ? 'bg-green-50' : st.achievementPct >= 80 ? 'bg-yellow-50' : 'bg-red-50';
                return (
                  <tr key={st.stationId} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD + ' text-right'}>{fmt(st.effectiveSalesVolume)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.targetVolume)}</td>
                    <td className={TD + ' text-right'}>{(st.varianceM3 >= 0 ? '+' : '') + fmt(st.varianceM3)}</td>
                    <td className={`${TD} text-right ${achShade}`}>{pct(st.achievementPct)}</td>
                    <td className={TD + ' text-center text-[10px]'}>{st.usingSageData ? 'Sage' : 'Returns'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle>4. Non-Revenue Water (NRW)</SectionTitle>
      <table className="w-full border border-gray-200 rounded text-left mb-3">
        <tbody>
          {[
            ['Total RW Abstracted', fmt(data.nrw.totalRWVolume) + ' m³'],
            ['Total CW Produced', fmt(data.nrw.totalCWVolume) + ' m³'],
            ['Total Sales Volume', fmt(data.nrw.totalSalesVolume) + ' m³'],
            ['Station Loss (Treatment)', fmt(data.nrw.stationLossVol) + ' m³ (' + pct(data.nrw.stationLossPct) + ')'],
            ['Distribution Loss', fmt(data.nrw.distributionLossVol) + ' m³ (' + pct(data.nrw.distributionLossPct) + ')'],
            ['Total NRW Loss', fmt(data.nrw.totalLossVol) + ' m³ (' + pct(data.nrw.totalLossPct) + ')'],
          ].map(([label, value], i) => {
            const isLoss = (label as string).includes('Loss');
            const nrwShade = isLoss && data.nrw.totalLossPct > 20 ? 'bg-red-50' : isLoss && data.nrw.totalLossPct > 10 ? 'bg-yellow-50' : TR_ALT(i);
            return (
              <tr key={label} className={isLoss ? nrwShade : TR_ALT(i)}>
                <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
                <td className={TD + ' text-right'}>{value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <SectionTitle>5. Chemical Stock</SectionTitle>
      {data.chemicals.map((chem, ci) => (
        <div key={chem.chemicalType} className="mb-4">
          <SubTitle>{ci + 1}. {chem.label}</SubTitle>
          <table className="w-full border border-gray-200 rounded text-left mb-2">
            <tbody>
              {[
                ['Opening Balance', fmt(chem.totalOpening, 1) + ' kg'],
                ['Total Received', fmt(chem.totalReceived, 1) + ' kg'],
                ['Total Used', fmt(chem.totalUsed, 1) + ' kg'],
                ['Used per m³ Produced', chem.usedPerM3 !== null && chem.usedPerM3 !== undefined ? fmt(chem.usedPerM3, 2) + ' g/m³' : 'N/A'],
                ['Closing Balance', fmt(chem.totalClosingBalance, 1) + ' kg'],
              ].map(([label, value], i) => (
                <tr key={label} className={TR_ALT(i)}>
                  <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
                  <td className={TD + ' text-right'}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {chem.stations.length > 0 && (
            <div className="overflow-x-auto mb-2">
              <table className="w-full border border-gray-200 rounded text-left">
                <thead>
                  <tr>
                    {['Station', 'Opening (kg)', 'Received (kg)', 'Used (kg)', 'g/m³', 'Closing (kg)', 'Days Rem.'].map(h => (
                      <th key={h} className={HDR2}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chem.stations.map((st, i) => {
                    const drShade = st.daysRemaining !== null && st.daysRemaining <= 5 ? 'bg-red-50'
                      : st.daysRemaining !== null && st.daysRemaining <= 10 ? 'bg-yellow-50' : TR_ALT(i);
                    return (
                      <tr key={st.stationName} className={TR_ALT(i)}>
                        <td className={TD + ' font-medium'}>{st.stationName}</td>
                        <td className={TD + ' text-right'}>{fmt(st.opening, 1)}</td>
                        <td className={TD + ' text-right'}>{fmt(st.received, 1)}</td>
                        <td className={TD + ' text-right'}>{fmt(st.used, 1)}</td>
                        <td className={TD + ' text-right'}>{(st as any).usedPerM3 !== null && (st as any).usedPerM3 !== undefined ? fmt((st as any).usedPerM3, 2) : 'N/A'}</td>
                        <td className={TD + ' text-right'}>{fmt(st.closing, 1)}</td>
                        <td className={`${TD} text-right ${drShade}`}>{st.daysRemaining !== null ? Math.round(st.daysRemaining) : 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {chem.lowStockCount > 0 && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              <span className="font-semibold">Low Stock: </span>
              {chem.lowStockStations.map(s => `${s.stationName} (${s.daysRemaining}d)`).join(', ')}
            </div>
          )}
        </div>
      ))}

      <SectionTitle>6. Breakdowns & Maintenance</SectionTitle>
      {data.breakdowns.length > 0 ? (
        <div className="overflow-x-auto mb-3">
          <table className="w-full border border-gray-200 rounded text-left">
            <thead>
              <tr>
                {['Station', 'Component', 'Impact', 'Date', 'Hrs Lost', 'Status'].map(h => (
                  <th key={h} className={HDR}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.breakdowns.map((b, i) => (
                <tr key={i} className={TR_ALT(i)}>
                  <td className={TD + ' font-medium'}>{b.stationName}</td>
                  <td className={TD}>{b.component}</td>
                  <td className={TD}>{b.impact}</td>
                  <td className={TD}>{fmtDate(b.dateReported)}</td>
                  <td className={TD + ' text-right'}>{b.hoursLost > 0 ? fmt(b.hoursLost, 1) : '—'}</td>
                  <td className={TD + ' text-center'}>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${b.isResolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {b.isResolved ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No breakdowns recorded during this month.</p>
      )}

      {data.kpiAnalysis && (
        <>
          <SectionTitle>7. KPI Summary Analysis</SectionTitle>
          <p className="text-xs text-gray-500 mb-2">Worst-performing station under each KPI for this reporting month.</p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['KPI', 'Worst Station', 'Value', 'Context / Detail'].map(h => (
                    <th key={h} className={HDR}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  data.kpiAnalysis.worstNRW && { label: 'Highest NRW Rate', kpi: data.kpiAnalysis.worstNRW },
                  data.kpiAnalysis.worstFinancialLoss && { label: 'Highest Water Loss Volume', kpi: data.kpiAnalysis.worstFinancialLoss },
                  data.kpiAnalysis.worstSalesAchievement && { label: 'Lowest Sales Achievement', kpi: data.kpiAnalysis.worstSalesAchievement },
                  data.kpiAnalysis.worstEfficiency && { label: 'Lowest Production Efficiency', kpi: data.kpiAnalysis.worstEfficiency },
                  data.kpiAnalysis.worstDowntime && { label: 'Highest Total Downtime', kpi: data.kpiAnalysis.worstDowntime },
                  data.kpiAnalysis.mostBreakdowns && { label: 'Most Breakdowns Recorded', kpi: data.kpiAnalysis.mostBreakdowns },
                ].filter(Boolean).map((item, i) => item && (
                  <tr key={item.label} className={TR_ALT(i)}>
                    <td className={TD + ' font-semibold'}>{item.label}</td>
                    <td className={TD}>{item.kpi.stationName}</td>
                    <td className={TD + ' text-right font-semibold'}>{item.kpi.value.toFixed ? item.kpi.value.toFixed(1) : item.kpi.value}{item.kpi.unit}</td>
                    <td className={TD + ' text-gray-500'}>{item.kpi.context}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportViewer({
  reportType,
  reportData,
  title,
  subtitle,
  onBack,
  onDownload,
  onRefresh,
  isDownloading = false,
  isRefreshing = false,
}: ReportViewerProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="w-px h-4 bg-gray-300" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-800 truncate">{title}</p>
          <p className="text-[10px] text-gray-500 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh report data from current database records"
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
          >
            <Download className="w-3 h-3" />
            {isDownloading ? 'Downloading...' : 'Download .docx'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-4">
        <div className="max-w-4xl">
          {reportType === 'weekly' ? (
            <WeeklyReportView data={reportData as WeeklyReportData} />
          ) : (
            <MonthlyReportView data={reportData as MonthlyReportData} />
          )}
        </div>
      </div>
    </div>
  );
}
