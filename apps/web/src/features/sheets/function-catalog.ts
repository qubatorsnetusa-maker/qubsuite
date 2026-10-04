export interface FunctionInfo {
  name: string;
  syntax: string;
  description: string;
}

export interface FunctionCategory {
  name: string;
  functions: FunctionInfo[];
}

/** The quick picks at the top of the Σ menu; each can be applied to the selection (AutoSum). */
export const AUTOSUM_FUNCTIONS = ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'] as const;
export type AutoSumFunction = (typeof AUTOSUM_FUNCTIONS)[number];

const f = (name: string, syntax: string, description: string): FunctionInfo => ({ name, syntax, description });

/** Every function the engine supports, grouped as in Google Sheets' Insert → Function menu. */
export const FUNCTION_CATEGORIES: FunctionCategory[] = [
  {
    name: 'Math',
    functions: [
      f('SUM', 'SUM(value1, [value2, …])', 'Adds numbers'),
      f('SUMIF', 'SUMIF(range, criterion, [sum_range])', 'Adds values that meet a condition'),
      f('SUMIFS', 'SUMIFS(sum_range, range1, criterion1, …)', 'Adds values that meet several conditions'),
      f('SUMPRODUCT', 'SUMPRODUCT(array1, [array2, …])', 'Sum of the products of matching items'),
      f('SUMSQ', 'SUMSQ(value1, [value2, …])', 'Sum of the squares'),
      f('PRODUCT', 'PRODUCT(value1, [value2, …])', 'Multiplies numbers'),
      f('ABS', 'ABS(value)', 'Absolute value'),
      f('ROUND', 'ROUND(value, [places])', 'Rounds to a number of decimal places'),
      f('ROUNDUP', 'ROUNDUP(value, [places])', 'Rounds away from zero'),
      f('ROUNDDOWN', 'ROUNDDOWN(value, [places])', 'Rounds towards zero'),
      f('CEILING', 'CEILING(value, [factor])', 'Rounds up to a multiple'),
      f('FLOOR', 'FLOOR(value, [factor])', 'Rounds down to a multiple'),
      f('INT', 'INT(value)', 'Rounds down to a whole number'),
      f('TRUNC', 'TRUNC(value, [places])', 'Drops decimal places'),
      f('MOD', 'MOD(dividend, divisor)', 'Remainder of a division'),
      f('QUOTIENT', 'QUOTIENT(dividend, divisor)', 'Whole part of a division'),
      f('POWER', 'POWER(base, exponent)', 'Raises a number to a power'),
      f('SQRT', 'SQRT(value)', 'Square root'),
      f('EXP', 'EXP(exponent)', 'e raised to a power'),
      f('LN', 'LN(value)', 'Natural logarithm'),
      f('LOG', 'LOG(value, [base])', 'Logarithm (base 10 by default)'),
      f('LOG10', 'LOG10(value)', 'Base-10 logarithm'),
      f('PI', 'PI()', 'The number π'),
      f('SIGN', 'SIGN(value)', '1, 0 or −1 by sign'),
      f('RAND', 'RAND()', 'Random number between 0 and 1'),
      f('RANDBETWEEN', 'RANDBETWEEN(low, high)', 'Random whole number in a range'),
    ],
  },
  {
    name: 'Statistical',
    functions: [
      f('AVERAGE', 'AVERAGE(value1, [value2, …])', 'Mean of numbers'),
      f('AVERAGEIF', 'AVERAGEIF(range, criterion, [average_range])', 'Mean of values that meet a condition'),
      f('AVERAGEIFS', 'AVERAGEIFS(average_range, range1, criterion1, …)', 'Mean of values that meet several conditions'),
      f('MEDIAN', 'MEDIAN(value1, [value2, …])', 'Middle value'),
      f('MODE', 'MODE(value1, [value2, …])', 'Most common value'),
      f('MODE.SNGL', 'MODE.SNGL(value1, [value2, …])', 'Most common value'),
      f('COUNT', 'COUNT(value1, [value2, …])', 'Counts numbers'),
      f('COUNTA', 'COUNTA(value1, [value2, …])', 'Counts non-empty cells'),
      f('COUNTBLANK', 'COUNTBLANK(range)', 'Counts empty cells'),
      f('COUNTIF', 'COUNTIF(range, criterion)', 'Counts cells that meet a condition'),
      f('COUNTIFS', 'COUNTIFS(range1, criterion1, …)', 'Counts cells that meet several conditions'),
      f('COUNTUNIQUE', 'COUNTUNIQUE(value1, [value2, …])', 'Counts distinct values'),
      f('MAX', 'MAX(value1, [value2, …])', 'Largest number'),
      f('MAXIFS', 'MAXIFS(range, criteria_range1, criterion1, …)', 'Largest value that meets conditions'),
      f('MIN', 'MIN(value1, [value2, …])', 'Smallest number'),
      f('MINIFS', 'MINIFS(range, criteria_range1, criterion1, …)', 'Smallest value that meets conditions'),
      f('LARGE', 'LARGE(data, n)', 'nth largest value'),
      f('SMALL', 'SMALL(data, n)', 'nth smallest value'),
      f('RANK', 'RANK(value, data, [ascending])', 'Position of a value in a list'),
      f('RANK.EQ', 'RANK.EQ(value, data, [ascending])', 'Position of a value in a list'),
      f('STDEV', 'STDEV(value1, [value2, …])', 'Standard deviation of a sample'),
      f('STDEV.S', 'STDEV.S(value1, [value2, …])', 'Standard deviation of a sample'),
      f('STDEVP', 'STDEVP(value1, [value2, …])', 'Standard deviation of a population'),
      f('STDEV.P', 'STDEV.P(value1, [value2, …])', 'Standard deviation of a population'),
      f('VAR', 'VAR(value1, [value2, …])', 'Variance of a sample'),
      f('VAR.S', 'VAR.S(value1, [value2, …])', 'Variance of a sample'),
      f('VARP', 'VARP(value1, [value2, …])', 'Variance of a population'),
      f('VAR.P', 'VAR.P(value1, [value2, …])', 'Variance of a population'),
    ],
  },
  {
    name: 'Logical',
    functions: [
      f('IF', 'IF(condition, value_if_true, [value_if_false])', 'One value or another'),
      f('IFS', 'IFS(condition1, value1, …)', 'Value of the first true condition'),
      f('SWITCH', 'SWITCH(expression, case1, value1, …, [default])', 'Value for the matching case'),
      f('IFERROR', 'IFERROR(value, value_if_error)', 'Fallback when there is an error'),
      f('IFNA', 'IFNA(value, value_if_na)', 'Fallback when a value is #N/A'),
      f('AND', 'AND(logical1, [logical2, …])', 'TRUE when all are true'),
      f('OR', 'OR(logical1, [logical2, …])', 'TRUE when any is true'),
      f('NOT', 'NOT(logical)', 'Opposite of a logical value'),
    ],
  },
  {
    name: 'Lookup',
    functions: [
      f('VLOOKUP', 'VLOOKUP(key, range, index, [sorted])', 'Looks down the first column'),
      f('HLOOKUP', 'HLOOKUP(key, range, index, [sorted])', 'Looks along the first row'),
      f('XLOOKUP', 'XLOOKUP(key, lookup_range, result_range, [missing])', 'Finds a match and returns its partner'),
      f('INDEX', 'INDEX(range, row, [column])', 'Value at a position'),
      f('MATCH', 'MATCH(key, range, [type])', 'Position of a value'),
    ],
  },
  {
    name: 'Text',
    functions: [
      f('CONCATENATE', 'CONCATENATE(text1, [text2, …])', 'Joins text'),
      f('CONCAT', 'CONCAT(text1, [text2, …])', 'Joins text'),
      f('TEXTJOIN', 'TEXTJOIN(delimiter, ignore_empty, text1, …)', 'Joins text with a separator'),
      f('LEFT', 'LEFT(text, [count])', 'Characters from the start'),
      f('RIGHT', 'RIGHT(text, [count])', 'Characters from the end'),
      f('MID', 'MID(text, start, length)', 'Characters from the middle'),
      f('LEN', 'LEN(text)', 'Number of characters'),
      f('FIND', 'FIND(search, text, [start])', 'Position of text (case-sensitive)'),
      f('SEARCH', 'SEARCH(search, text, [start])', 'Position of text (any case)'),
      f('SUBSTITUTE', 'SUBSTITUTE(text, search, replacement, [occurrence])', 'Replaces text'),
      f('UPPER', 'UPPER(text)', 'Upper case'),
      f('LOWER', 'LOWER(text)', 'Lower case'),
      f('PROPER', 'PROPER(text)', 'Capitalises each word'),
      f('TRIM', 'TRIM(text)', 'Removes extra spaces'),
      f('REPT', 'REPT(text, times)', 'Repeats text'),
      f('EXACT', 'EXACT(text1, text2)', 'Whether two texts are identical'),
      f('TEXT', 'TEXT(value, format)', 'Formats a number as text'),
      f('VALUE', 'VALUE(text)', 'Converts text to a number'),
    ],
  },
  {
    name: 'Date',
    functions: [
      f('TODAY', 'TODAY()', "Today's date"),
      f('NOW', 'NOW()', 'Current date and time'),
      f('DATE', 'DATE(year, month, day)', 'Builds a date'),
      f('TIME', 'TIME(hour, minute, second)', 'Builds a time'),
      f('YEAR', 'YEAR(date)', 'Year of a date'),
      f('MONTH', 'MONTH(date)', 'Month of a date'),
      f('DAY', 'DAY(date)', 'Day of a date'),
      f('HOUR', 'HOUR(time)', 'Hour of a time'),
      f('MINUTE', 'MINUTE(time)', 'Minute of a time'),
      f('WEEKDAY', 'WEEKDAY(date, [type])', 'Day of the week'),
      f('EDATE', 'EDATE(start, months)', 'Date some months away'),
      f('EOMONTH', 'EOMONTH(start, months)', 'Last day of a month'),
      f('DATEDIF', 'DATEDIF(start, end, unit)', 'Difference between dates'),
      f('DATEVALUE', 'DATEVALUE(text)', 'Converts text to a date'),
    ],
  },
  {
    name: 'Info',
    functions: [
      f('ISBLANK', 'ISBLANK(value)', 'Whether a cell is empty'),
      f('ISNUMBER', 'ISNUMBER(value)', 'Whether a value is a number'),
      f('ISTEXT', 'ISTEXT(value)', 'Whether a value is text'),
      f('ISERROR', 'ISERROR(value)', 'Whether a value is an error'),
    ],
  },
];
