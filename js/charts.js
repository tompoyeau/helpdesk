let chartCat = null;
let chartMonth = null;

function updateCharts() {
  // if (!filtered) return;

  // const c = filtered.byCat;
  // const m = filtered.byMonth;

  // const cl = Object.keys(c);
  // const cd = Object.values(c);
  // const cc = cl.map(x => colors[x] || "#999");

  // if (!chartCat) {
  //   chartCat = new ApexCharts(document.getElementById("chartCategories"), {
  //     chart: { type: "donut", height: "100%", animations: { enabled: true } },
  //     labels: cl,
  //     series: cd,
  //     colors: cc,
  //     legend: { position: "bottom", fontSize: "10px" },
  //     dataLabels: { enabled: false }
  //   });
  //   chartCat.render();
  // } else {
  //   chartCat.updateOptions({ labels: cl, colors: cc });
  //   chartCat.updateSeries(cd);
  // }

  // const ml = Object.keys(m).sort();
  // const md = ml.map(k => m[k]);

  // if (!chartMonth) {
  //   chartMonth = new ApexCharts(document.getElementById("chartMonths"), {
  //     chart: { type: "bar", height: "100%", animations: { enabled: true } },
  //     series: [{ data: md }],
  //     xaxis: {
  //       categories: ml,
  //       labels: { style: { fontSize: "10px" } }
  //     },
  //     plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
  //     colors: ["#2563eb"],
  //     dataLabels: { enabled: false }
  //   });
  //   chartMonth.render();
  // } else {
  //   chartMonth.updateOptions({ xaxis: { categories: ml } });
  //   chartMonth.updateSeries([{ data: md }]);
  // }

  // updateKPIs();
  // updatePodium();
  return ;
}

function updateKPIs() {
  // const days = [...filtered.byDay].sort();
  // els.kpiP.textContent = days.length ? `${days[0]} → ${days[days.length - 1]}` : "Aucune donnée";
  // els.kpiD.textContent = days.length;
  // els.kpiS.textContent = filtered.totalSlots;

  // let top = "-";
  // let val = 0;
  // for (const c in filtered.byCat) {
  //   if (filtered.byCat[c] > val) {
  //     val = filtered.byCat[c];
  //     top = c;
  //   }
  // }
  // els.kpiT.textContent = top === "-" ? "–" : `${top} (${val})`;
return ;
}

function updatePodium() {
  // const podiumEl = els.podium;

  // if (!currentCategory) {
  //   podiumEl.innerHTML = `<div class="text-slate-400 col-span-5">Sélectionne une catégorie pour voir le podium</div>`;
  //   return;
  // }

  // let arr = [];

  // for (const p in filtered.byPerson) {
  //   let s = 0;
  //   for (const d in filtered.byPerson[p].details) {
  //     filtered.byPerson[p].details[d].forEach(e => {
  //       if (e.categorie === currentCategory) s++;
  //     });
  //   }
  //   if (s > 0) arr.push([p, s]);
  // }

  // arr.sort((a, b) => b[1] - a[1]);
  // arr = arr.slice(0, 5);

  // if (!arr.length) {
  //   podiumEl.innerHTML = `<div class="text-slate-400 col-span-5">Aucune donnée pour cette catégorie</div>`;
  //   return;
  // }

  // podiumEl.innerHTML = arr.map(([p, s], i) => `
  //   <div class="p-2 bg-slate-50 border rounded text-center">
  //     <div class="font-bold text-sm">${i + 1}</div>
  //     <div class="text-xs truncate">${p}</div>
  //     <div class="text-[11px] text-slate-600">${s} créneaux</div>
  //   </div>
  // `).join("");
  return ;
}