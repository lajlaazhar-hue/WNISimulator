/*
 * countries.js — the country catalog.
 * Only Indonesia has a loaded dataset in this version. The other entries
 * describe how each country's wage floor is structured so the setup screen
 * can explain it, but no amounts are shipped for them: dataStatus
 * 'not_loaded' means the country is visible but not playable yet.
 */
(function (root) {
  const RLS = (root.RLS = root.RLS || {});
  RLS.data = RLS.data || {};

  RLS.data.countries = [
    {
      id: 'id', name: 'Indonesia', flagCode: 'ID', currency: 'IDR', locale: 'id-ID',
      dataStatus: 'loaded',
      wageSystem: 'Provincial minimum wage (UMP) set by each governor, with higher city/regency minimum wages (UMK) in many areas. Sector wages (UMSP/UMSK) exist in some places and are not modelled here.',
    },
    { id: 'kr', name: 'South Korea', flagCode: 'KR', currency: 'KRW', locale: 'ko-KR', dataStatus: 'not_loaded',
      wageSystem: 'One national hourly minimum wage, with an official monthly equivalent based on 209 paid hours.' },
    { id: 'jp', name: 'Japan', flagCode: 'JP', currency: 'JPY', locale: 'ja-JP', dataStatus: 'not_loaded',
      wageSystem: 'Hourly minimum wages set per prefecture; they differ between Tokyo and rural prefectures.' },
    { id: 'au', name: 'Australia', flagCode: 'AU', currency: 'AUD', locale: 'en-AU', dataStatus: 'not_loaded',
      wageSystem: 'A national minimum wage set by the Fair Work Commission, with higher rates under modern awards for many jobs.' },
    { id: 'nz', name: 'New Zealand', flagCode: 'NZ', currency: 'NZD', locale: 'en-NZ', dataStatus: 'not_loaded',
      wageSystem: 'Hourly minimum wage with separate adult, starting-out and training rates.' },
    { id: 'gb', name: 'United Kingdom', flagCode: 'GB', currency: 'GBP', locale: 'en-GB', dataStatus: 'not_loaded',
      wageSystem: 'National Living Wage for older workers and lower age-banded National Minimum Wage rates.' },
    { id: 'us', name: 'United States', flagCode: 'US', currency: 'USD', locale: 'en-US', dataStatus: 'not_loaded',
      wageSystem: 'A federal floor, overridden by higher state and city minimum wages where they exist.' },
    { id: 'sg', name: 'Singapore', flagCode: 'SG', currency: 'SGD', locale: 'en-SG', dataStatus: 'not_loaded',
      wageSystem: 'No universal minimum wage. Progressive Wage Model floors apply to specific sectors and occupations.' },
    { id: 'my', name: 'Malaysia', flagCode: 'MY', currency: 'MYR', locale: 'ms-MY', dataStatus: 'not_loaded',
      wageSystem: 'National minimum wage order with a monthly rate and derived daily and hourly rates.' },
    { id: 'th', name: 'Thailand', flagCode: 'TH', currency: 'THB', locale: 'th-TH', dataStatus: 'not_loaded',
      wageSystem: 'Daily minimum wages set per province.' },
    { id: 'ph', name: 'Philippines', flagCode: 'PH', currency: 'PHP', locale: 'en-PH', dataStatus: 'not_loaded',
      wageSystem: 'Daily minimum wages set by regional wage boards through wage orders, varying by region and sector.' },
    { id: 'de', name: 'Germany', flagCode: 'DE', currency: 'EUR', locale: 'de-DE', dataStatus: 'not_loaded',
      wageSystem: 'One national statutory hourly minimum wage.' },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = RLS.data.countries;
})(typeof globalThis !== 'undefined' ? globalThis : this);
