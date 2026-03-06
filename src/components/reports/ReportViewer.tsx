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

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Number(n).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
  if (!data) return <p className="text-xs text-gray-500 py-8 text-center">No report data available. Try refreshing.</p>;
  const reportTypeLbl = data.reportType === 'friday' ? 'Friday (End of Week)' : 'Tuesday (Mid-week)';
  const prod = data.production || {} as any;
  const cap = data.capacityUtilization || {} as any;
  const pwr = data.powerSupply || {} as any;
  const conn = data.connections || {} as any;
  const chems = data.chemicals || [];
  const bkd = data.breakdowns || [];

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <KVRow label="Report Type" value={reportTypeLbl} />
        <KVRow label="Period" value={`${fmtDate(data.periodStart || '')} – ${fmtDate(data.periodEnd || '')}`} />
        <KVRow label="Service Centre" value={data.serviceCentreName || ''} />
        <KVRow label="Week" value={`Week ${data.weekNumber ?? ''}, ${data.year ?? ''}`} />
        <KVRow label="Data Coverage" value={`${data.totalActualLogs ?? 0} of ${data.totalExpectedLogs ?? 0} logs (${data.completionPct ?? 0}%)`} />
        <KVRow label="Generated" value={new Date(data.generatedAt).toLocaleString('en-GB')} />
      </div>

      <SectionTitle>1. Production Overview</SectionTitle>
      <table className="w-full border border-gray-200 rounded text-left mb-3">
        <tbody>
          {[
            ['Total CW Volume', fmt(prod.totalCWVolume) + ' m\u00b3'],
            ['Total CW Volume YTD', fmt(prod.totalCWVolumeYTD) + ' m\u00b3'],
            ['CW Weekly Target', fmt(prod.cwWeeklyTarget) + ' m\u00b3'],
            ['CW Performance', pct(prod.cwPerformancePct)],
            ['Total RW Volume', fmt(prod.totalRWVolume) + ' m\u00b3'],
            ['CW Hours Run', fmt(prod.totalCWHours, 1) + ' hrs'],
            ['RW Hours Run', fmt(prod.totalRWHours, 1) + ' hrs'],
            ['Avg CW Pump Rate', prod.avgCWPumpRate != null ? fmt(prod.avgCWPumpRate, 1) + ' m\u00b3/hr' : 'N/A'],
            ['Avg Efficiency', pct(prod.avgEfficiency)],
            ['Load Shedding', fmt(prod.totalLoadShedding, 1) + ' hrs'],
            ['Other Downtime', fmt(prod.totalOtherDowntime, 1) + ' hrs'],
            ['Breakdown Hours Lost', fmt(prod.totalBreakdownHoursLost, 1) + ' hrs'],
            ['New Connections', String(prod.totalNewConnections ?? 0)],
          ].map(([label, value], i) => (
            <tr key={label} className={TR_ALT(i)}>
              <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
              <td className={TD + ' text-gray-800 text-right'}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(prod.stations || []).length > 0 && (
        <>
          <SubTitle>2.1 Station-Level Production</SubTitle>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded text-left mb-3">
              <thead>
                <tr>
                  {['Station', 'Type', 'CW Vol (m\u00b3)', 'CW YTD (m\u00b3)', 'CW Hrs', 'Downtime (hrs)', 'Eff. (%)'].map(h => (
                    <th key={h} className={HDR2}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(prod.stations || []).map((st: any, i: number) => (
                  <tr key={st.stationId} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD}>{st.stationType}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwVolume)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwVolumeYTD)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwHours, 1)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.totalDowntime, 1)}</td>
                    <td className={TD + ' text-right'}>{pct(st.efficiency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(data.ytdProductionVsTarget?.stations || []).length > 0 && (
        <>
          <SubTitle>YTD CW Production Performance vs Target</SubTitle>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Station', 'YTD Production (m\u00b3)', 'YTD Target (m\u00b3)', 'Variance (m\u00b3)', 'Achievement (%)'].map(h => (
                    <th key={h} className={HDR2}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.ytdProductionVsTarget.stations.map((st: any, i: number) => {
                  const achShade = st.achievementPct == null ? TR_ALT(i)
                    : st.achievementPct >= 100 ? 'bg-green-50' : st.achievementPct >= 80 ? 'bg-yellow-50' : 'bg-red-50';
                  return (
                    <tr key={st.stationId} className={TR_ALT(i)}>
                      <td className={TD + ' font-medium'}>{st.stationName}</td>
                      <td className={TD + ' text-right'}>{fmt(st.ytdProduction)}</td>
                      <td className={TD + ' text-right'}>{fmt(st.ytdTarget)}</td>
                      <td className={TD + ' text-right'}>{(st.variance >= 0 ? '+' : '') + fmt(st.variance)}</td>
                      <td className={`${TD} text-right ${achShade}`}>{st.achievementPct != null ? fmt(st.achievementPct, 1) + '%' : 'N/A'}</td>
                    </tr>
                  );
                })}
                <tr className="bg-[#D6EAF8] font-semibold">
                  <td className={TD + ' font-bold'}>TOTAL</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(data.ytdProductionVsTarget.totalYTDProduction)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(data.ytdProductionVsTarget.totalYTDTarget)}</td>
                  <td className={TD + ' text-right font-bold'}>{(data.ytdProductionVsTarget.totalVariance >= 0 ? '+' : '') + fmt(data.ytdProductionVsTarget.totalVariance)}</td>
                  <td className={TD + ' text-right font-bold'}>{data.ytdProductionVsTarget.totalAchievementPct != null ? fmt(data.ytdProductionVsTarget.totalAchievementPct, 1) + '%' : 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionTitle>3. Capacity Utilization</SectionTitle>
      {(cap.stations || []).filter((s: any) => s.stationType === 'Full Treatment').length > 0 && (
        <>
          <SubTitle>3.1 RW Pumping Capacity (Full Treatment Stations)</SubTitle>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Station', 'Installed (m\u00b3/hr)', 'Weekly RW (m\u00b3/hr)', 'YTD Avg RW (m\u00b3/hr)', 'Utilization (%)'].map(h => (
                    <th key={h} className={HDR}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cap.stations || []).filter((s: any) => s.stationType === 'Full Treatment').map((st: any, i: number) => (
                  <tr key={st.stationId} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD + ' text-right'}>{st.installedCapacity > 0 ? fmt(st.installedCapacity, 1) : '-'}</td>
                    <td className={TD + ' text-right'}>{st.weeklyRWCapacity != null ? fmt(st.weeklyRWCapacity, 1) : '-'}</td>
                    <td className={TD + ' text-right'}>{st.ytdRWCapacity != null ? fmt(st.ytdRWCapacity, 1) : '-'}</td>
                    <td className={TD + ' text-right'}>{st.rwUtilizationPct != null ? fmt(st.rwUtilizationPct, 1) + '%' : '-'}</td>
                  </tr>
                ))}
                <tr className="bg-[#D6EAF8] font-semibold">
                  <td className={TD + ' font-bold'}>TOTAL</td>
                  <td className={TD + ' text-right font-bold'}>{cap.rwInstalledTotal > 0 ? fmt(cap.rwInstalledTotal, 1) : '-'}</td>
                  <td className={TD + ' text-right font-bold'}>{cap.rwWeeklyActualTotal != null ? fmt(cap.rwWeeklyActualTotal, 1) : '-'}</td>
                  <td className={TD + ' text-right font-bold'}>{cap.rwYtdAvgTotal != null ? fmt(cap.rwYtdAvgTotal, 1) : '-'}</td>
                  <td className={TD + ' text-right font-bold'}>{cap.rwUtilizationPct != null ? fmt(cap.rwUtilizationPct, 1) + '%' : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
      <SubTitle>3.2 CW Pumping Capacity (All Stations)</SubTitle>
      <div className="overflow-x-auto mb-3">
        <table className="w-full border border-gray-200 rounded text-left">
          <thead>
            <tr>
              {['Station', 'Type', 'Installed (m\u00b3/hr)', 'Weekly CW (m\u00b3/hr)', 'YTD Avg CW (m\u00b3/hr)', 'Utilization (%)'].map(h => (
                <th key={h} className={HDR}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(cap.stations || []).map((st: any, i: number) => (
              <tr key={st.stationId} className={TR_ALT(i)}>
                <td className={TD + ' font-medium'}>{st.stationName}</td>
                <td className={TD}>{st.stationType}</td>
                <td className={TD + ' text-right'}>{st.installedCapacity > 0 ? fmt(st.installedCapacity, 1) : '-'}</td>
                <td className={TD + ' text-right'}>{st.weeklyCWCapacity != null ? fmt(st.weeklyCWCapacity, 1) : '-'}</td>
                <td className={TD + ' text-right'}>{st.ytdCWCapacity != null ? fmt(st.ytdCWCapacity, 1) : '-'}</td>
                <td className={TD + ' text-right'}>{st.cwUtilizationPct != null ? fmt(st.cwUtilizationPct, 1) + '%' : '-'}</td>
              </tr>
            ))}
            <tr className="bg-[#D6EAF8] font-semibold">
              <td className={TD + ' font-bold'}>TOTAL</td>
              <td className={TD}></td>
              <td className={TD + ' text-right font-bold'}>{cap.cwInstalledTotal > 0 ? fmt(cap.cwInstalledTotal, 1) : '-'}</td>
              <td className={TD + ' text-right font-bold'}>{cap.cwWeeklyActualTotal != null ? fmt(cap.cwWeeklyActualTotal, 1) : '-'}</td>
              <td className={TD + ' text-right font-bold'}>{cap.cwYtdAvgTotal != null ? fmt(cap.cwYtdAvgTotal, 1) : '-'}</td>
              <td className={TD + ' text-right font-bold'}>{cap.cwUtilizationPct != null ? fmt(cap.cwUtilizationPct, 1) + '%' : '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionTitle>4. Power Supply &amp; Hours</SectionTitle>
      {(pwr.stations || []).length > 0 ? (
        <div className="overflow-x-auto mb-3">
          <table className="w-full border border-gray-200 rounded text-left">
            <thead>
              <tr>
                {['Station', 'Required Hours', 'Load Shedding (hrs)', 'Power Available (hrs)', 'Power Availability (%)', 'Actual Hours Run', 'Grid Utilization (%)'].map(h => (
                  <th key={h} className={HDR}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(pwr.stations || []).map((st: any, i: number) => {
                const rowClass = st.gridUtilizationPct < 50 ? 'bg-red-50' : TR_ALT(i);
                return (
                  <tr key={st.stationId} className={rowClass}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD + ' text-right'}>{fmt(st.requiredHours, 1)}</td>
                    <td className={TD + ' text-right'}>{st.loadSheddingHours > 0 ? fmt(st.loadSheddingHours, 1) : '-'}</td>
                    <td className={TD + ' text-right'}>{fmt(st.powerAvailableHours, 1)}</td>
                    <td className={TD + ' text-right'}>{pct(st.powerAvailabilityPct)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.actualHoursRun, 1)}</td>
                    <td className={TD + ' text-right'}>{pct(st.gridUtilizationPct)}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#D6EAF8] font-semibold">
                <td className={TD + ' font-bold'}>TOTAL</td>
                <td className={TD + ' text-right font-bold'}>{fmt(pwr.totalRequiredHours, 1)}</td>
                <td className={TD + ' text-right font-bold'}>{pwr.totalLoadSheddingHours > 0 ? fmt(pwr.totalLoadSheddingHours, 1) : '-'}</td>
                <td className={TD + ' text-right font-bold'}>{fmt(pwr.totalPowerAvailableHours, 1)}</td>
                <td className={TD + ' text-right font-bold'}>{pct(pwr.overallAvailabilityPct)}</td>
                <td className={TD + ' text-right font-bold'}>{fmt(pwr.totalActualHours, 1)}</td>
                <td className={TD + ' text-right font-bold'}>{pct(pwr.overallGridUtilizationPct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            ['Required Hours', fmt(pwr.totalRequiredHours, 0) + ' hrs'],
            ['Actual Hours', fmt(pwr.totalActualHours, 0) + ' hrs'],
            ['Availability', pct(pwr.overallAvailabilityPct)],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
              <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>5. Connections</SectionTitle>
      <table className="w-full border border-gray-200 rounded text-left mb-3">
        <tbody>
          {[
            ['Total Current Connections', fmt(conn.totalCurrentConnections)],
            ['New Connections This Week', String(conn.totalNewThisWeek ?? 0)],
            ['New Total Connections', String(conn.totalNewTotal ?? 0)],
            ['Year-to-Date New Connections', String(conn.totalYTDNew ?? 0)],
          ].map(([label, value], i) => (
            <tr key={label} className={TR_ALT(i)}>
              <td className={TD + ' font-medium text-gray-700 w-56'}>{label}</td>
              <td className={TD + ' text-right'}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(() => {
        const stationsWithNew = (conn.stations || []).filter((s: any) => s.newConnectionsThisWeek > 0);
        return stationsWithNew.length > 0 ? (
          <>
            <SubTitle>5.1 Stations with New Connections</SubTitle>
            <div className="overflow-x-auto mb-3">
              <table className="w-full border border-gray-200 rounded text-left">
                <thead>
                  <tr>
                    {['Station', 'Current', 'New (Week)', 'New Total', 'YTD New'].map(h => (
                      <th key={h} className={HDR2}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stationsWithNew.map((st: any, i: number) => (
                    <tr key={st.stationId} className={TR_ALT(i)}>
                      <td className={TD + ' font-medium'}>{st.stationName}</td>
                      <td className={TD + ' text-right'}>{fmt(st.currentConnections)}</td>
                      <td className={TD + ' text-right'}>{fmt(st.newConnectionsThisWeek)}</td>
                      <td className={TD + ' text-right'}>{fmt(st.newTotal)}</td>
                      <td className={TD + ' text-right'}>{fmt(st.ytdNewConnections)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 mb-3">No new connections recorded this week.</p>
        );
      })()}

      <SectionTitle>6. Downtime Analysis</SectionTitle>
      {(prod.stations || []).filter((s: any) => s.totalDowntime > 0).length > 0 ? (
        <div className="overflow-x-auto mb-3">
          <table className="w-full border border-gray-200 rounded text-left">
            <thead>
              <tr>
                {['Station', 'Load Shedding (hrs)', 'Other Downtime (hrs)', 'Total (hrs)', 'Status'].map(h => (
                  <th key={h} className={HDR}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(prod.stations || [])
                .filter((s: any) => s.totalDowntime > 0)
                .sort((a: any, b: any) => b.totalDowntime - a.totalDowntime)
                .map((st: any, i: number) => {
                  const statusLabel = st.totalDowntime > 48 ? 'CRITICAL' : st.totalDowntime > 24 ? 'WARNING' : 'NORMAL';
                  const statusClass = st.totalDowntime > 48 ? 'bg-red-100 text-red-800' : st.totalDowntime > 24 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
                  return (
                    <tr key={st.stationId} className={TR_ALT(i)}>
                      <td className={TD + ' font-medium'}>{st.stationName}</td>
                      <td className={TD + ' text-right'}>{fmt(st.loadSheddingHours, 1)}</td>
                      <td className={TD + ' text-right'}>{fmt(st.otherDowntimeHours, 1)}</td>
                      <td className={TD + ' text-right font-semibold'}>{fmt(st.totalDowntime, 1)}</td>
                      <td className={TD + ' text-center'}>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${statusClass}`}>{statusLabel}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No downtime recorded during this period.</p>
      )}

      <SectionTitle>7. Breakdowns</SectionTitle>
      {bkd.length > 0 ? (
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
              {bkd.map((b: any, i: number) => (
                <tr key={i} className={b.impact === 'Stopped pumping' && b.hoursLost > 0 ? 'bg-red-50' : TR_ALT(i)}>
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

      <SectionTitle>8. Chemical Stock Status</SectionTitle>

      {data.weekOnWeekChemicals?.weeks && data.weekOnWeekChemicals.weeks.length > 0 && (
        <>
          <SubTitle>8.1 Week-on-Week Chemical Usage</SubTitle>
          <div className="overflow-x-auto mb-4">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  <th className={HDR2}></th>
                  <th className={HDR2 + ' text-right'}>Alum (kg)</th>
                  <th className={HDR2 + ' text-right'}>HTH (kg)</th>
                  <th className={HDR2 + ' text-right'}>Act. Carbon (Kg)</th>
                </tr>
              </thead>
              <tbody>
                {data.weekOnWeekChemicals.weeks.map((week: any, i: number) => (
                  <tr key={week.weekNumber} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{week.weekLabel}</td>
                    <td className={TD + ' text-right'}>{fmt(week.alumKg, 0)}</td>
                    <td className={TD + ' text-right'}>{fmt(week.hthKg, 0)}</td>
                    <td className={TD + ' text-right'}>{fmt(week.activatedCarbonKg, 0)}</td>
                  </tr>
                ))}
                <tr className="bg-[#D6EAF8] font-semibold">
                  <td className={TD + ' font-bold'}>Ave</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(data.weekOnWeekChemicals.avgAlumKg, 0)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(data.weekOnWeekChemicals.avgHthKg, 0)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(data.weekOnWeekChemicals.avgActivatedCarbonKg, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {chems.map((chem: any, ci: number) => (
        <div key={chem.chemicalType} className="mb-4">
          <SubTitle>8.{data.weekOnWeekChemicals?.weeks?.length > 0 ? ci + 2 : ci + 1} {chem.label}</SubTitle>
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
              {chem.lowStockStations.map((s: any) => `${s.stationName} (${s.daysRemaining}d)`).join(', ')}
            </div>
          )}
        </div>
      ))}

      {(data as any).rwYTDAllocations && (data as any).rwYTDAllocations.length > 0 && (
        <>
          <SectionTitle>9. Raw Water Allocations</SectionTitle>
          <SubTitle>9.1 YTD Water Allocated per Dam</SubTitle>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Dam', 'Code', 'Agreements', 'YTD Allocated (ML)'].map(h => (
                    <th key={h} className={HDR}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {((data as any).rwYTDAllocations || []).map((dam: any, i: number) => (
                  <tr key={dam.damName} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{dam.damName}</td>
                    <td className={TD}>{dam.damCode || '-'}</td>
                    <td className={TD + ' text-right'}>{dam.agreementCount}</td>
                    <td className={TD + ' text-right'}>{fmt(dam.ytdAllocationVolume, 2)}</td>
                  </tr>
                ))}
                <tr className="bg-[#E8EEF5] font-semibold">
                  <td className={TD + ' font-bold'}>TOTAL</td>
                  <td className={TD}></td>
                  <td className={TD + ' text-right font-bold'}>{((data as any).rwYTDAllocations || []).reduce((s: number, d: any) => s + d.agreementCount, 0)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(((data as any).rwYTDAllocations || []).reduce((s: number, d: any) => s + d.ytdAllocationVolume, 0), 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MonthlyReportView({ data }: { data: MonthlyReportData }) {
  if (!data) return <p className="text-xs text-gray-500 py-8 text-center">No report data available. Try refreshing.</p>;
  const prod = data.production || {} as any;
  const sales = data.sales || {} as any;
  const nrw = data.nrw || {} as any;
  const chems = data.chemicals || [];
  const bkd = data.breakdowns || [];

  return (
    <div>
      <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
        <KVRow label="Service Centre" value={data.serviceCentreName || ''} />
        <KVRow label="Reporting Month" value={`${data.monthName || ''} ${data.year ?? ''}`} />
        <KVRow label="Active Stations" value={String(prod.stationCount ?? 0)} />
        <KVRow label="Data Completeness" value={`${data.totalActualLogs ?? 0} of ${data.totalExpectedLogs ?? 0} logs (${data.completionPct ?? 0}%)`} />
        <KVRow label="Generated" value={data.generatedAt ? new Date(data.generatedAt).toLocaleString('en-GB') : 'N/A'} />
      </div>

      <SectionTitle>1. Executive Summary</SectionTitle>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          ['Total CW Volume', fmt(prod.totalCWVolume) + ' m\u00b3'],
          ['Total Sales Volume', fmt(sales.totalEffectiveSalesVolume) + ' m\u00b3'],
          ['Sales Achievement', pct(sales.overallAchievementPct)],
          ['Total NRW Losses', fmt(nrw.totalLossVol) + ' m\u00b3 (' + pct(nrw.totalLossPct) + ')'],
          ['New Connections', String(prod.totalNewConnections ?? 0)],
          ['New Connections YTD', String(prod.totalNewConnectionsYTD ?? 0)],
          ['Total Breakdowns', String(bkd.length)],
          ['Breakdown Hrs Lost', fmt(prod.totalBreakdownHoursLost, 1) + ' hrs'],
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
            ['Total CW Volume', fmt(prod.totalCWVolume) + ' m\u00b3'],
            ['Total RW Volume', fmt(prod.totalRWVolume) + ' m\u00b3'],
            ['Total CW Hours Run', fmt(prod.totalCWHours, 1) + ' hrs'],
            ['Total RW Hours Run', fmt(prod.totalRWHours, 1) + ' hrs'],
            ['Avg CW Pump Rate', prod.avgCWPumpRate != null ? fmt(prod.avgCWPumpRate, 1) + ' m\u00b3/hr' : 'N/A'],
            ['Average Efficiency', pct(prod.avgEfficiency)],
            ['Load Shedding Hours', fmt(prod.totalLoadShedding, 1) + ' hrs'],
            ['Other Downtime Hours', fmt(prod.totalOtherDowntime, 1) + ' hrs'],
            ['Total Downtime', fmt(prod.totalDowntime, 1) + ' hrs'],
            ['New Connections', String(prod.totalNewConnections ?? 0)],
            ['New Connections YTD', String(prod.totalNewConnectionsYTD ?? 0)],
            ['Breakdown Hours Lost', fmt(prod.totalBreakdownHoursLost, 1) + ' hrs'],
          ].map(([label, value], i) => (
            <tr key={label} className={TR_ALT(i)}>
              <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
              <td className={TD + ' text-right'}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(prod.stations || []).length > 0 && (
        <>
          <SubTitle>Station Production Detail</SubTitle>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Station', 'Type', 'CW Vol (m\u00b3)', 'CW Hrs', 'Efficiency', 'Downtime (hrs)', 'New Conn.'].map(h => (
                    <th key={h} className={HDR2}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(prod.stations || []).map((st: any, i: number) => (
                  <tr key={st.stationId} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD}>{st.stationType}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwVolume)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.cwHours, 1)}</td>
                    <td className={TD + ' text-right'}>{pct(st.efficiency)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.totalDowntime, 1)}</td>
                    <td className={TD + ' text-right'}>{st.newConnections ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(data.ytdProductionVsTarget?.stations || []).length > 0 && (
        <>
          <SubTitle>YTD CW Production Performance vs Target</SubTitle>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Station', 'YTD Production (m\u00b3)', 'YTD Target (m\u00b3)', 'Variance (m\u00b3)', 'Achievement (%)'].map(h => (
                    <th key={h} className={HDR2}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.ytdProductionVsTarget.stations.map((st: any, i: number) => {
                  const achShade = st.achievementPct == null ? TR_ALT(i)
                    : st.achievementPct >= 100 ? 'bg-green-50' : st.achievementPct >= 80 ? 'bg-yellow-50' : 'bg-red-50';
                  return (
                    <tr key={st.stationId} className={TR_ALT(i)}>
                      <td className={TD + ' font-medium'}>{st.stationName}</td>
                      <td className={TD + ' text-right'}>{fmt(st.ytdProduction)}</td>
                      <td className={TD + ' text-right'}>{fmt(st.ytdTarget)}</td>
                      <td className={TD + ' text-right'}>{(st.variance >= 0 ? '+' : '') + fmt(st.variance)}</td>
                      <td className={`${TD} text-right ${achShade}`}>{st.achievementPct != null ? fmt(st.achievementPct, 1) + '%' : 'N/A'}</td>
                    </tr>
                  );
                })}
                <tr className="bg-[#D6EAF8] font-semibold">
                  <td className={TD + ' font-bold'}>TOTAL</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(data.ytdProductionVsTarget.totalYTDProduction)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(data.ytdProductionVsTarget.totalYTDTarget)}</td>
                  <td className={TD + ' text-right font-bold'}>{(data.ytdProductionVsTarget.totalVariance >= 0 ? '+' : '') + fmt(data.ytdProductionVsTarget.totalVariance)}</td>
                  <td className={TD + ' text-right font-bold'}>{data.ytdProductionVsTarget.totalAchievementPct != null ? fmt(data.ytdProductionVsTarget.totalAchievementPct, 1) + '%' : 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <SectionTitle>3. Sales Performance</SectionTitle>
      <table className="w-full border border-gray-200 rounded text-left mb-3">
        <tbody>
          {[
            ['Total Sales Volume', fmt(sales.totalEffectiveSalesVolume) + ' m\u00b3'],
            ['Total Target', fmt(sales.totalTargetVolume) + ' m\u00b3'],
            ['Variance', ((sales.overallVarianceM3 ?? 0) >= 0 ? '+' : '') + fmt(sales.overallVarianceM3) + ' m\u00b3'],
            ['Achievement', pct(sales.overallAchievementPct)],
          ].map(([label, value], i) => (
            <tr key={label} className={TR_ALT(i)}>
              <td className={TD + ' font-medium text-gray-700 w-52'}>{label}</td>
              <td className={TD + ' text-right'}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(sales.stations || []).length > 0 && (
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
              {(sales.stations || []).map((st: any, i: number) => {
                const achShade = st.achievementPct == null ? TR_ALT(i)
                  : st.achievementPct >= 100 ? 'bg-green-50' : st.achievementPct >= 80 ? 'bg-yellow-50' : 'bg-red-50';
                return (
                  <tr key={st.stationId} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{st.stationName}</td>
                    <td className={TD + ' text-right'}>{fmt(st.effectiveSalesVolume)}</td>
                    <td className={TD + ' text-right'}>{fmt(st.targetVolume)}</td>
                    <td className={TD + ' text-right'}>{((st.varianceM3 ?? 0) >= 0 ? '+' : '') + fmt(st.varianceM3)}</td>
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
            ['Total RW Abstracted', fmt(nrw.totalRWVolume) + ' m\u00b3'],
            ['Total CW Produced', fmt(nrw.totalCWVolume) + ' m\u00b3'],
            ['Total Sales Volume', fmt(nrw.totalSalesVolume) + ' m\u00b3'],
            ['Station Loss (Treatment)', fmt(nrw.stationLossVol) + ' m\u00b3 (' + pct(nrw.stationLossPct) + ')'],
            ['Distribution Loss', fmt(nrw.distributionLossVol) + ' m\u00b3 (' + pct(nrw.distributionLossPct) + ')'],
            ['Total NRW Loss', fmt(nrw.totalLossVol) + ' m\u00b3 (' + pct(nrw.totalLossPct) + ')'],
          ].map(([label, value], i) => {
            const isLoss = (label as string).includes('Loss');
            const nrwShade = isLoss && (nrw.totalLossPct ?? 0) > 20 ? 'bg-red-50' : isLoss && (nrw.totalLossPct ?? 0) > 10 ? 'bg-yellow-50' : TR_ALT(i);
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
      {chems.map((chem: any, ci: number) => (
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
      {bkd.length > 0 ? (
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
              {bkd.map((b: any, i: number) => (
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
              {(prod.totalBreakdownHoursLost ?? 0) > 0 && (
                <tr className="bg-yellow-50 font-semibold">
                  <td className={TD + ' font-bold'}>TOTAL PUMPING HRS LOST</td>
                  <td className={TD}></td>
                  <td className={TD}>Stopped pumping</td>
                  <td className={TD}></td>
                  <td className={TD + ' text-right font-bold bg-red-50'}>{fmt(prod.totalBreakdownHoursLost, 1)}</td>
                  <td className={TD}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No breakdowns recorded during this month.</p>
      )}

      {(data as any).energy && ((data as any).energy.stations || []).length > 0 && (
        <>
          <SectionTitle>7. Energy Consumption & Cost Analysis</SectionTitle>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              ['Estimated Consumption', fmt((data as any).energy.totalEstimatedKWh) + ' kWh'],
              ['Estimated Cost', '$' + fmt((data as any).energy.totalEstimatedCost, 2)],
              ['Actual ZESA Bill', '$' + fmt((data as any).energy.totalActualBill, 2)],
              ['Variance', (data as any).energy.overallVariancePct != null ? ((data as any).energy.overallVariancePct >= 0 ? '+' : '') + fmt((data as any).energy.overallVariancePct, 1) + '%' : 'N/A'],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">{label}</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Station', 'Est. kWh', 'Est. Cost ($)', 'Actual Bill ($)', 'Actual kWh', 'Variance (%)'].map(h => (
                    <th key={h} className={HDR2}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {((data as any).energy.stations || []).map((st: any, i: number) => {
                  const vPct = st.totalEstCost > 0 ? ((st.totalActBill - st.totalEstCost) / st.totalEstCost) * 100 : null;
                  const varShade = vPct == null ? TR_ALT(i)
                    : Math.abs(vPct) <= 10 ? 'bg-green-50' : Math.abs(vPct) <= 25 ? 'bg-yellow-50' : 'bg-red-50';
                  return (
                    <tr key={st.stationId} className={TR_ALT(i)}>
                      <td className={TD + ' font-medium'}>{st.stationName}</td>
                      <td className={TD + ' text-right'}>{fmt(st.totalEstKWh)}</td>
                      <td className={TD + ' text-right'}>{fmt(st.totalEstCost, 2)}</td>
                      <td className={TD + ' text-right'}>{st.totalActBill > 0 ? fmt(st.totalActBill, 2) : '---'}</td>
                      <td className={TD + ' text-right'}>{st.totalActKWh > 0 ? fmt(st.totalActKWh) : '---'}</td>
                      <td className={`${TD} text-right ${varShade}`}>{vPct != null ? (vPct >= 0 ? '+' : '') + fmt(vPct, 1) + '%' : '---'}</td>
                    </tr>
                  );
                })}
                <tr className="bg-[#D6EAF8] font-semibold">
                  <td className={TD + ' font-bold'}>TOTAL</td>
                  <td className={TD + ' text-right font-bold'}>{fmt((data as any).energy.totalEstimatedKWh)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt((data as any).energy.totalEstimatedCost, 2)}</td>
                  <td className={TD + ' text-right font-bold'}>{(data as any).energy.totalActualBill > 0 ? fmt((data as any).energy.totalActualBill, 2) : '---'}</td>
                  <td className={TD + ' text-right font-bold'}>{(data as any).energy.totalActualKWh > 0 ? fmt((data as any).energy.totalActualKWh) : '---'}</td>
                  <td className={TD + ' text-right font-bold'}>{(data as any).energy.overallVariancePct != null ? ((data as any).energy.overallVariancePct >= 0 ? '+' : '') + fmt((data as any).energy.overallVariancePct, 1) + '%' : '---'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.kpiAnalysis && (
        <>
          <SectionTitle>8. KPI Summary Analysis</SectionTitle>
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

      {((data as any).rwDamReport || []).length > 0 && (
        <>
          <SectionTitle>9. Raw Water</SectionTitle>
          <SubTitle>9.1 Water Allocation &amp; Sales by Dam</SubTitle>
          <div className="overflow-x-auto mb-3">
            <table className="w-full border border-gray-200 rounded text-left">
              <thead>
                <tr>
                  {['Dam', 'Code', 'Agreements', 'Allocated (ML)', 'Sales (ML)'].map(h => (
                    <th key={h} className={HDR}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {((data as any).rwDamReport || []).map((dam: any, i: number) => (
                  <tr key={dam.damName} className={TR_ALT(i)}>
                    <td className={TD + ' font-medium'}>{dam.damName}</td>
                    <td className={TD}>{dam.damCode || '-'}</td>
                    <td className={TD + ' text-right'}>{dam.agreementCount}</td>
                    <td className={TD + ' text-right'}>{fmt(dam.allocationVolume, 2)}</td>
                    <td className={TD + ' text-right'}>{fmt(dam.salesVolume, 2)}</td>
                  </tr>
                ))}
                <tr className="bg-[#E8EEF5] font-semibold">
                  <td className={TD + ' font-bold'}>TOTAL</td>
                  <td className={TD}></td>
                  <td className={TD + ' text-right font-bold'}>{((data as any).rwDamReport || []).reduce((s: number, d: any) => s + d.agreementCount, 0)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(((data as any).rwDamReport || []).reduce((s: number, d: any) => s + d.allocationVolume, 0), 2)}</td>
                  <td className={TD + ' text-right font-bold'}>{fmt(((data as any).rwDamReport || []).reduce((s: number, d: any) => s + d.salesVolume, 0), 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {(data as any).rwAgreementStats && (
        <>
          <SubTitle>9.2 Agreement Statistics</SubTitle>
          <table className="w-full border border-gray-200 rounded text-left mb-3">
            <thead>
              <tr>
                <th className={HDR}>Metric</th>
                <th className={HDR + ' text-right'}>Count</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: `Active agreements in ${data.year}`, value: (data as any).rwAgreementStats.totalActiveInYear },
                { label: 'Currently active agreements', value: (data as any).rwAgreementStats.currentlyActive },
                { label: `Expired in ${data.monthName}`, value: (data as any).rwAgreementStats.expiredInMonth },
                { label: 'Expiring next month', value: (data as any).rwAgreementStats.expiringNextMonth },
              ].map((row, i) => (
                <tr key={row.label} className={row.label.includes('Expiring') && row.value > 0 ? 'bg-yellow-50' : TR_ALT(i)}>
                  <td className={TD + ' font-medium text-gray-700'}>{row.label}</td>
                  <td className={TD + ' text-right font-semibold'}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            className="flex items-center gap-1 px-2 py-1 bg-blue-300 hover:bg-blue-400 disabled:opacity-50 text-blue-900 text-xs font-semibold rounded transition-colors"
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
