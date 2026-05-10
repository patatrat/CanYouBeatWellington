---
title: "Wellington's Shitsville is real"
date: '2026-04-14'
author: Patrick Radomski
excerpt: >-
  I used six years of Wellington weather data to fix the rules on Can You Beat
  Wellington. Turns out some seasons just don't have good days, and Wellington doesn't have 4 seasons.
featuredImage: 'https://pb.haume.nz/api/files/xd6xm0awdmqjjln/ihha0w3fjuho8kw/realistic_calendar_shitsville_light_white_text_small_BEmaMzonIQ.png'
tags:
  - Wellington
  - Projects
  - Data
  - Can You Beat Wellington
mastodonUrl: ''
publishDate: ''
---

Since I launched [Can You Beat Wellington](https://canyoubeatwellington.radomski.co.nz/) back in 2024, the most common complaint has been that the rules are too strict. The app judges a good Wellington day as: temperature at least 18°C, wind under 20 km/h, and no rain. Sounds reasonable. Turns out it basically never happens.

I now have six years of weather data in the database, so I asked Claude to analyse it and suggest better rules. The results were interesting, and they led me down a rabbit hole involving a very famous Wellington meme.

## The current rules are basically broken

Six years of data. 2,290 days. Under the current rules, **50 of them were good days**. That's 2.2%.

More damning: from May through October, there was not a single good day in the entire dataset. Not one. The wind threshold of 20 km/h is the main culprit. Wellington has wind under 20 km/h on only 12% of all days. We are, after all, the windiest city in the world.

<script>
(function() {
  var d = document.documentElement;
  var dark = d.classList.contains('dark');
  d.style.setProperty('--color-background-secondary', dark ? '#27272a' : '#f4f4f5');
  d.style.setProperty('--color-text-primary',         dark ? '#f4f4f5' : '#18181b');
  d.style.setProperty('--color-text-secondary', '#71717a');
  d.style.setProperty('--color-text-tertiary',  '#a1a1aa');
  d.style.setProperty('--color-border-danger',  dark ? '#f87171' : '#fca5a5');
  d.style.setProperty('--color-text-danger',    '#ef4444');
  d.style.setProperty('--border-radius-md',     '8px');
})();
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>


<h2 class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;">Bar chart of Wellington daily wind speed distribution over six years. Only 12% of days fall under the old 20 km/h threshold. Raising to 30 km/h covers 39% of days.</h2>

<div style="position:relative;width:100%;height:240px;">
  <canvas id="windChart" role="img" aria-label="Bar chart of Wellington wind speed distribution. 0-10 km/h: 1.9%, 10-20: 10.3%, 20-30: 27.2%, 30-40: 31.2%, 40-50: 22.3%, 50-60: 6.1%, 60-70: 0.7%, 70+: 0.1%. Old threshold covers 12%. New threshold covers 39%.">0-10 km/h 1.9%, 10-20 10.3%, 20-30 27.2%, 30-40 31.2%, 40-50 22.3%, 50-60 6.1%, 60+ under 1%.</canvas>
</div>
<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px;font-size:12px;color:var(--color-text-secondary);">
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#1D9E75;"></span>Under old 20 km/h threshold (12% of days)</span>
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#BA7517;"></span>Newly covered by 30 km/h threshold (+27%)</span>
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#B4B2A9;"></span>Still too windy</span>
</div>

<script>
const isDark = document.documentElement.classList.contains('dark');
const gridCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
const textCol = isDark ? '#b4b2a9' : '#5f5e5a';
const colors = [
  isDark?'#0F6E56':'#1D9E75', isDark?'#0F6E56':'#1D9E75',
  isDark?'#854F0B':'#BA7517',
  isDark?'#5F5E5A':'#888780', isDark?'#5F5E5A':'#888780',
  isDark?'#5F5E5A':'#888780', isDark?'#5F5E5A':'#888780', isDark?'#5F5E5A':'#888780',
];
new Chart(document.getElementById('windChart'), {
  type: 'bar',
  data: {
    labels: ['0–10','10–20','20–30','30–40','40–50','50–60','60–70','70+'],
    datasets: [{ data: [1.9,10.3,27.2,31.2,22.3,6.1,0.7,0.1], backgroundColor: colors, borderRadius: 3 }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: i => `${i.raw.toFixed(1)}% of days`,
          afterLabel: i => ['Covered by old threshold','Covered by old threshold','Newly covered by 30 km/h threshold'][i.dataIndex] || 'Still too windy'
        }
      }
    },
    scales: {
      x: { ticks: { color: textCol }, grid: { color: gridCol }, title: { display: true, text: 'Daily wind speed (km/h)', color: textCol, font: { size: 12 } } },
      y: { ticks: { color: textCol, callback: v => v+'%' }, grid: { color: gridCol }, title: { display: true, text: '% of all days', color: textCol, font: { size: 12 } } }
    }
  }
});
</script>


Raising that to 30 km/h -- still genuinely light wind by Wellington standards -- unlocks another 27% of days. The 18°C temperature floor does the rest of the damage, particularly through the cooler months.

## Shitsville is real, and the numbers prove it

If you've spent any time in Wellington you'll know [the Shitsville calendar](https://adam.nz/realistic-calendar), proposed by Adam Shand in a 2014 tweet that went viral. Wellington doesn't have four seasons, it has six:

![The Realistic Wellington Calendar by Adam Shand, showing Wellington's six seasons: Summer, Autumn, Winter, Spring 1, Shitsville, and Spring 2](https://pb.haume.nz/api/files/xd6xm0awdmqjjln/ihha0w3fjuho8kw/realistic_calendar_shitsville_light_white_text_small_BEmaMzonIQ.png)

Summer runs January through March. Autumn April through June. Winter July and August. Then September brings Spring 1 -- a brief, tantalising patch of fine weather. Then October and November are Shitsville. December is Spring 2, a cautious recovery before summer proper arrives.

Adam has said he wishes he'd called it "False Hope" or "Bait and Switch." The cruelty of Shitsville is that Spring 1 precedes it, setting expectations that October and November then systematically destroy.

Six years of weather data say he was onto something. Surprising no Wellingtonian, ever.


<h2 class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;">Season comparison cards and chart showing Shitsville has higher wind speeds and more rain days than Winter, statistically validating the Wellington Shitsville calendar.</h2>

<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:1.25rem;">
  <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:0.6rem 0.5rem;text-align:center;">
    <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Summer</div>
    <div style="font-size:9px;color:var(--color-text-tertiary);margin-bottom:5px;">Jan–Mar</div>
    <div style="font-size:16px;font-weight:500;color:var(--color-text-primary);">18.2°</div>
    <div style="font-size:10px;color:var(--color-text-secondary);margin-top:3px;">31.7 km/h</div>
    <div style="font-size:10px;color:var(--color-text-secondary);">48% rain</div>
  </div>
  <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:0.6rem 0.5rem;text-align:center;">
    <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Autumn</div>
    <div style="font-size:9px;color:var(--color-text-tertiary);margin-bottom:5px;">Apr–Jun</div>
    <div style="font-size:16px;font-weight:500;color:var(--color-text-primary);">15.1°</div>
    <div style="font-size:10px;color:var(--color-text-secondary);margin-top:3px;">31.4 km/h</div>
    <div style="font-size:10px;color:var(--color-text-secondary);">56% rain</div>
  </div>
  <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:0.6rem 0.5rem;text-align:center;">
    <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Winter</div>
    <div style="font-size:9px;color:var(--color-text-tertiary);margin-bottom:5px;">Jul–Aug</div>
    <div style="font-size:16px;font-weight:500;color:var(--color-text-primary);">12.2°</div>
    <div style="font-size:10px;color:var(--color-text-secondary);margin-top:3px;">33.1 km/h</div>
    <div style="font-size:10px;color:var(--color-text-secondary);">63% rain</div>
  </div>
  <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:0.6rem 0.5rem;text-align:center;">
    <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Spring 1</div>
    <div style="font-size:9px;color:var(--color-text-tertiary);margin-bottom:5px;">Sep</div>
    <div style="font-size:16px;font-weight:500;color:var(--color-text-primary);">13.5°</div>
    <div style="font-size:10px;color:var(--color-text-secondary);margin-top:3px;">38.3 km/h</div>
    <div style="font-size:10px;color:var(--color-text-secondary);">61% rain</div>
  </div>
  <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:0.6rem 0.5rem;text-align:center;border:1.5px solid var(--color-border-danger);">
    <div style="font-size:10px;color:var(--color-text-danger);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;font-weight:500;">Shitsville</div>
    <div style="font-size:9px;color:var(--color-text-tertiary);margin-bottom:5px;">Oct–Nov</div>
    <div style="font-size:16px;font-weight:500;color:var(--color-text-primary);">15.7°</div>
    <div style="font-size:10px;color:var(--color-text-secondary);margin-top:3px;">35.8 km/h</div>
    <div style="font-size:10px;color:var(--color-text-danger);font-weight:500;">65% rain</div>
  </div>
  <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:0.6rem 0.5rem;text-align:center;">
    <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Spring 2</div>
    <div style="font-size:9px;color:var(--color-text-tertiary);margin-bottom:5px;">Dec</div>
    <div style="font-size:16px;font-weight:500;color:var(--color-text-primary);">18.1°</div>
    <div style="font-size:10px;color:var(--color-text-secondary);margin-top:3px;">35.2 km/h</div>
    <div style="font-size:10px;color:var(--color-text-secondary);">62% rain</div>
  </div>
</div>

<div style="position:relative;width:100%;height:210px;">
  <canvas id="seasonChart" role="img" aria-label="Grouped bar chart comparing average wind speed and rain day percentage by Wellington season. Shitsville has the highest rain day percentage at 65% and wind of 35.8 km/h, higher than Summer and Autumn and close to Winter.">Summer 31.7 km/h 48% rain. Autumn 31.4 km/h 56% rain. Winter 33.1 km/h 63% rain. Spring 1 38.3 km/h 61% rain. Shitsville 35.8 km/h 65% rain. Spring 2 35.2 km/h 62% rain.</canvas>
</div>

<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px;font-size:12px;color:var(--color-text-secondary);">
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#1D9E75;"></span>Avg wind speed (left axis)</span>
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#5DCAA5;"></span>Rain days % (right axis)</span>
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#E24B4A;"></span>Shitsville</span>
</div>

<script>
const isDark = document.documentElement.classList.contains('dark');
const gridCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
const textCol = isDark ? '#b4b2a9' : '#5f5e5a';
const isS = [false,false,false,false,true,false];
const windColors = isS.map(s => s ? (isDark?'#A32D2D':'#E24B4A') : (isDark?'#0F6E56':'#1D9E75'));
const rainColors = isS.map(s => s ? (isDark?'#712B13':'#F09995') : (isDark?'#085041':'#5DCAA5'));

new Chart(document.getElementById('seasonChart'), {
  type: 'bar',
  data: {
    labels: ['Summer','Autumn','Winter','Spring 1','Shitsville','Spring 2'],
    datasets: [
      { label: 'Avg wind (km/h)', data: [31.7,31.4,33.1,38.3,35.8,35.2], backgroundColor: windColors, borderRadius: 3, yAxisID: 'y' },
      { label: 'Rain days (%)', data: [48.1,56.4,62.9,61.1,64.5,62.4], backgroundColor: rainColors, borderRadius: 3, yAxisID: 'y2' }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
    scales: {
      x: { ticks: { color: textCol, font: { size: 11 } }, grid: { color: gridCol } },
      y: {
        type: 'linear', position: 'left', min: 28, max: 42,
        ticks: { color: isDark?'#5DCAA5':'#0F6E56', callback: v => v+' km/h' },
        grid: { color: gridCol },
        title: { display: true, text: 'Avg wind (km/h)', color: isDark?'#5DCAA5':'#0F6E56', font: { size: 11 } }
      },
      y2: {
        type: 'linear', position: 'right', min: 40, max: 75,
        ticks: { color: isDark?'#F0997B':'#993C1D', callback: v => v+'%' },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Rain days (%)', color: isDark?'#F0997B':'#993C1D', font: { size: 11 } }
      }
    }
  }
});
</script>


The headline number: **Shitsville (October and November) has higher average wind speeds than Winter (July and August).** Winter averages 33.1 km/h. Shitsville averages 35.8 km/h. It's warmer than winter, but windier and with the highest rain day percentage of any season at 65%. It's the worst of both worlds -- not cold enough to feel properly wintery, but too wet and blustery to actually enjoy.

Spring 2 (December) tells a similar story: 35.2 km/h average wind and 62% rain days. The data firmly places December outside the summer category, which anyone who has been caught out without a jacket in early December already knows.

## The new rules

The Shitsville calendar describes Wellington's actual weather better than the conventional four seasons, so it makes sense to build the rules around it. Here's the updated approach:

**Wind: raising the cap to 30 km/h.** Under 20 km/h covered only 12% of all days. Under 30 km/h is still meaningfully calm for Wellington -- you'd notice it, but you wouldn't be fighting for control of your umbrella.

**Rain: staying at 0mm.** Rain is rain. This one isn't moving.

**Temperature: seasonal thresholds.** A good day in each season should actually feel good for that time of year -- not just warm enough to technically qualify.

| Month | Season | New threshold |
|---|---|---|
| Jan, Feb, Mar | Summer | ≥19°C |
| Apr, May, Jun | Autumn | ≥16°C |
| Jul, Aug | Winter | ≥13°C |
| Sep | Spring 1 | ≥14°C |
| Oct, Nov | Shitsville | ≥16°C |
| Dec | Spring 2 | ≥18°C |

Here's what that produces:


<h2 class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;">Bar chart comparing percentage of good Wellington days per month under old rules versus new honest seasonal rules. Some months like June naturally produce zero good days.</h2>

<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:10px;font-size:12px;color:var(--color-text-secondary);">
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#B4B2A9;"></span>Old rules (≥18°C, wind&lt;20 km/h, rain=0)</span>
  <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#1D9E75;"></span>New rules (seasonal temp, wind&lt;30 km/h, rain=0)</span>
</div>

<div style="position:relative;width:100%;height:300px;">
  <canvas id="goodDaysChart" role="img" aria-label="Grouped bar chart showing percentage of good Wellington days per month under old and new rules. Old rules produce zero good days May through October. New rules produce good days in most months but June is naturally zero, and Shitsville months are low single digits.">Old rules 6.2% Jan, 10.1% Feb, 4.1% Mar, 1.5% Apr, 0% May–Oct, 1.7% Nov, 1.1% Dec. New rules: 15.6% Jan, 15.7% Feb, 8.8% Mar, 20.6% Apr, 4.8% May, 0% Jun, 9.1% Jul, 7% Aug, 7.2% Sep, 3.2% Oct, 8.9% Nov, 7% Dec.</canvas>
</div>

<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:11px;color:var(--color-text-secondary);">
  <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#1D9E75;display:inline-block;"></span>Summer Jan–Mar (≥19°C)</span>
  <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#BA7517;display:inline-block;"></span>Autumn Apr–Jun (≥16°C)</span>
  <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#378ADD;display:inline-block;"></span>Winter Jul–Aug (≥13°C)</span>
  <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#5DCAA5;display:inline-block;"></span>Spring 1 Sep (≥14°C)</span>
  <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#E24B4A;display:inline-block;"></span>Shitsville Oct–Nov (≥16°C)</span>
  <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#7F77DD;display:inline-block;"></span>Spring 2 Dec (≥18°C)</span>
</div>

<script>
const isDark = document.documentElement.classList.contains('dark');
const gridCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
const textCol = isDark ? '#b4b2a9' : '#5f5e5a';

const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const seasons = ['Summer','Summer','Summer','Autumn','Autumn','Autumn','Winter','Winter','Spring 1','Shitsville','Shitsville','Spring 2'];
const thresholds = [19,19,19,16,16,16,13,13,14,16,16,18];
const oldData = [6.2,10.1,4.1,1.5,0,0,0,0,0,0,1.7,1.1];
const newData = [15.6,15.7,8.8,20.6,4.8,0,9.1,7.0,7.2,3.2,8.9,7.0];

const seasonColors = {
  'Summer':    isDark ? '#0F6E56' : '#1D9E75',
  'Autumn':    isDark ? '#854F0B' : '#BA7517',
  'Winter':    isDark ? '#185FA5' : '#378ADD',
  'Spring 1':  isDark ? '#085041' : '#5DCAA5',
  'Shitsville':isDark ? '#A32D2D' : '#E24B4A',
  'Spring 2':  isDark ? '#3C3489' : '#7F77DD',
};

new Chart(document.getElementById('goodDaysChart'), {
  type: 'bar',
  data: {
    labels,
    datasets: [
      { label: 'Old rules', data: oldData, backgroundColor: isDark?'#444441':'#D3D1C7', borderRadius: 3 },
      { label: 'New rules', data: newData, backgroundColor: seasons.map(s => seasonColors[s]), borderRadius: 3 }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: i => `${labels[i[0].dataIndex]} — ${seasons[i[0].dataIndex]}`,
          label: i => i.datasetIndex === 0
            ? `Old rules: ${i.raw.toFixed(1)}% good days`
            : `New rules: ${i.raw.toFixed(1)}% good days (≥${thresholds[i.dataIndex]}°C)`
        }
      }
    },
    scales: {
      x: { ticks: { color: textCol, autoSkip: false, maxRotation: 0 }, grid: { color: gridCol } },
      y: {
        ticks: { color: textCol, callback: v => v+'%' },
        grid: { color: gridCol },
        title: { display: true, text: '% good days', color: textCol, font: { size: 12 } },
        max: 25
      }
    }
  }
});
</script>


A few things worth noting. The rules don't try to force an even distribution of good days across the year -- some months naturally have fewer, and that's fine. **June produces zero good days under these rules.** That's not a bug. June in Wellington averages 13.3°C, averages 31 km/h of wind, and has rain more than 60% of the time. A sensible temperature threshold of 16°C combined with the wind and rain requirements means June never gets a good day -- and across six years of data, that has held without exception.

Shitsville is similarly tough -- at 16°C+ with wind under 30 km/h and no rain, you get about 6% of days in October and November. That feels right. Good days do happen in Shitsville, but they're rare and you tend to remember them.

**April is the standout surprise.** It produces good days about 20% of the time -- making it not just the best month in Autumn, but one of the best months of the year. May manages around 5%, and June contributes nothing. So "Autumn" as a season is really just April doing the work while May and June quietly behave like winter.

## What the data reveals

With six years of daily records now in the database, some patterns stand out.

**The longest good-day streak on record is four days.** It has happened a handful of times. Wellington doesn't do runs of nice weather -- it gives you a good day, sometimes two, then reasserts itself.

**January 2022 was the best single month ever recorded**: 10 good days out of 31, a 32% hit rate. No other month comes close. April shows up repeatedly in the top ten -- it appeared five times in the best months across all years, which tracks with the 20% average.

**September is the windiest month, not winter.** This one surprised me. In July and August, wind exceeds 30 km/h on about 70% of days. In September -- notionally Spring 1, the good bit -- it's 77%. September has the temperature and often the dry spells, but the wind guts it almost every time. The Spring 1 season is less "brief tantalising patch of fine weather" and more "warm enough to be cruel about how windy it is."

**Year to year, there's no real trend.** 2021 was the best year on record at 10.1% good days. 2024 was the worst at 7.9%. The variation is noise, not signal. Wellington is just like this.

## The result across the year

Overall about 9% of all days qualify as good under the new rules. The rule set stops trying to pretend all seasons are equally capable of good days, and instead reflects what Wellington actually is: brilliant when it's good, and honest about when it isn't.

All historical data has been retroactively recalculated. Because `isGoodDay` is computed at runtime rather than stored in the database, the whole history updates for free -- one of the better decisions from [the recent refactor](/blog/the-rules-were-wrong).

The code is [open source](https://github.com/patatrat/CanYouBeatWellington) if you want to argue about the thresholds.
