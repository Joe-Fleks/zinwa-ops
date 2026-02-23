export const getYesterday = (): Date => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
};

export const getYesterdayString = (): string => {
  const yesterday = getYesterday();
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getCurrentWeekDates = (): { start: string; end: string } => {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const daysFromFriday = (dayOfWeek + 2) % 7;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromFriday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0]
  };
};

export const getCurrentMonthDates = (): { start: string; end: string } => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

export const getCurrentQuarterDates = (): { start: string; end: string } => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const quarterStartMonth = Math.floor(month / 3) * 3;

  const start = new Date(year, quarterStartMonth, 1);
  const end = new Date(year, quarterStartMonth + 3, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

export const getCurrentYearDates = (): { start: string; end: string } => {
  const today = new Date();
  const year = today.getFullYear();

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

export const getLast7DaysFromYesterday = (): string => {
  const yesterday = getYesterday();
  const sevenDaysAgo = new Date(yesterday);
  sevenDaysAgo.setDate(yesterday.getDate() - 6);
  return sevenDaysAgo.toISOString().split('T')[0];
};

export const formatDateForDisplay = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString: string): string => {
  const SYSTEM_TIMEZONE = import.meta.env.VITE_TIMEZONE || 'UTC';
  return new Date(dateString).toLocaleString('en-ZW', {
    timeZone: SYSTEM_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

export const getCurrentWeekNumber = (): number => {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const daysFromFriday = (dayOfWeek + 2) % 7;

  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - daysFromFriday);

  const firstFridayOfYear = new Date(today.getFullYear(), 0, 1);
  const firstDayOfWeek = firstFridayOfYear.getDay();
  const daysToFirstFriday = firstDayOfWeek <= 5 ? 5 - firstDayOfWeek : 12 - firstDayOfWeek;
  firstFridayOfYear.setDate(firstFridayOfYear.getDate() + daysToFirstFriday);

  const daysDifference = Math.floor((currentWeekStart.getTime() - firstFridayOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysDifference / 7) + 1;

  return weekNumber > 0 ? weekNumber : 1;
};

export const isCurrentWeekComplete = (): boolean => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  return dayOfWeek === 5;
};

export const isCurrentMonthComplete = (): boolean => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return tomorrow.getMonth() !== today.getMonth();
};

export const getWeekDatesWithOffset = (weekOffset: number, year?: number): { start: string; end: string } => {
  const today = new Date();
  const targetYear = year || today.getFullYear();

  const dayOfWeek = today.getDay();
  const daysFromFriday = (dayOfWeek + 2) % 7;

  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - daysFromFriday);

  const targetWeekStart = new Date(currentWeekStart);
  targetWeekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));

  if (year && targetWeekStart.getFullYear() !== targetYear) {
    targetWeekStart.setFullYear(targetYear);
  }

  const targetWeekEnd = new Date(targetWeekStart);
  targetWeekEnd.setDate(targetWeekStart.getDate() + 6);

  return {
    start: targetWeekStart.toISOString().split('T')[0],
    end: targetWeekEnd.toISOString().split('T')[0]
  };
};

export const getWeekNumberForDate = (dateString: string): number => {
  const date = new Date(dateString + 'T12:00:00');
  const dayOfWeek = date.getDay();

  const daysFromFriday = (dayOfWeek + 2) % 7;

  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - daysFromFriday);

  const firstFridayOfYear = new Date(date.getFullYear(), 0, 1, 12, 0, 0);
  const firstDayOfWeek = firstFridayOfYear.getDay();
  const daysToFirstFriday = firstDayOfWeek <= 5 ? 5 - firstDayOfWeek : 12 - firstDayOfWeek;
  firstFridayOfYear.setDate(firstFridayOfYear.getDate() + daysToFirstFriday);

  const daysDifference = Math.floor((weekStart.getTime() - firstFridayOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysDifference / 7) + 1;

  console.log('=== getWeekNumberForDate DEBUG ===');
  console.log('Input date:', dateString);
  console.log('Parsed date:', date.toDateString(), 'Day of week:', dayOfWeek);
  console.log('Days from Friday:', daysFromFriday);
  console.log('Week start:', weekStart.toDateString());
  console.log('First Friday:', firstFridayOfYear.toDateString());
  console.log('Days difference:', daysDifference);
  console.log('Calculated week number:', weekNumber);

  return weekNumber > 0 ? weekNumber : 1;
};

export const shouldShowPreviousWeek = (): boolean => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  return dayOfWeek === 5;
};

export const getMaxWeekNumberForYear = (year: number): number => {
  const lastDayOfYear = new Date(year, 11, 31);
  return getWeekNumberForDate(lastDayOfYear.toISOString().split('T')[0]);
};

export const canEditProductionLog = (dateString: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logDate = new Date(dateString + 'T00:00:00');
  logDate.setHours(0, 0, 0, 0);

  return logDate < today;
};

export const getEditableUntilDate = (dateString: string): string => {
  const logDate = new Date(dateString + 'T00:00:00');
  const nextDay = new Date(logDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.toISOString().split('T')[0];
};

export const getWeekDateRangeForWeekNumber = (weekNumber: number, year: number): { start: string; end: string } => {
  const firstFridayOfYear = new Date(year, 0, 1, 12, 0, 0);
  const firstDayOfWeek = firstFridayOfYear.getDay();
  const daysToFirstFriday = firstDayOfWeek <= 5 ? 5 - firstDayOfWeek : 12 - firstDayOfWeek;
  firstFridayOfYear.setDate(firstFridayOfYear.getDate() + daysToFirstFriday);

  console.log('=== getWeekDateRangeForWeekNumber DEBUG ===');
  console.log('Year:', year, 'Week:', weekNumber);
  console.log('Jan 1 day of week:', firstDayOfWeek, '(0=Sun, 1=Mon, ..., 5=Fri)');
  console.log('Days to first Friday:', daysToFirstFriday);
  console.log('First Friday of year:', firstFridayOfYear.toDateString());

  const targetWeekStart = new Date(firstFridayOfYear);
  targetWeekStart.setDate(firstFridayOfYear.getDate() + ((weekNumber - 1) * 7));

  const targetWeekEnd = new Date(targetWeekStart);
  targetWeekEnd.setDate(targetWeekStart.getDate() + 6);

  console.log('Target week start:', targetWeekStart.toDateString(), targetWeekStart.toISOString().split('T')[0]);
  console.log('Target week end:', targetWeekEnd.toDateString(), targetWeekEnd.toISOString().split('T')[0]);

  return {
    start: targetWeekStart.toISOString().split('T')[0],
    end: targetWeekEnd.toISOString().split('T')[0]
  };
};
