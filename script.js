const models = {
  nbm: { name:'NBM', phase:'All timeframes', phaseLabel:'ALL TIMEFRAMES · DECISION ANCHOR', source:'psu-nbm', imageBase:'https://mapwall.met.psu.edu/images/NBM', region:'NE', product:'totalsnow', start:3, end:120, step:3, description:'Penn State’s latest NBM total accumulated snowfall guidance, shown as a native forecast loop. NBM blends many models and corrects known biases for a calibrated snowfall baseline.', action:'Use it to anchor final accumulation expectations throughout the storm.' },
  euros: { name:'ECMWF + ECMWF-AIFS', phase:'3–10 days out', phaseLabel:'PHASE 01 · LONG-RANGE COMPARISON', comparison:true, description:'Use the traditional ECMWF to establish the storm’s physics: track, cold air, and moisture supply. Use ECMWF-AIFS as its AI pattern-recognition counterpart to challenge that setup.', action:'Agreement raises confidence in the long-range signal. When they disagree, treat the storm details as uncertain and watch which solution gains support in later runs.', members:[
    { name:'ECMWF', imageBase:'https://m4o.pivotalweather.com/maps/models/ecmwf_full/2026092312', product:'sn10_006h-imp', start:6, end:240, step:6 },
    { name:'ECMWF-AIFS', imageBase:'https://m4o.pivotalweather.com/maps/models/ecmwf_aifs/2026092312', product:'sn10_006h-imp', start:6, end:360, step:6 }
  ] },
  nam: { name:'NAM 3km', phase:'24–60 hours', phaseLabel:'PHASE 02 · REGIONAL DETAIL', title:'NAM 3km snowfall model', imageBase:'https://m4o.pivotalweather.com/maps/models/nam4km/2026092312', product:'snod-imp', start:1, end:60, step:1, description:'Use NAM’s finer grid once the storm is closer. It resolves terrain and local cold-air effects that broad global models smooth out.', action:'Locate the exact snow, sleet, freezing rain and rain transition zone.' },
  hrrr: { name:'HRRR', phase:'0–18 hours', phaseLabel:'PHASE 03 · GAME DAY', title:'HRRR snowfall model', imageBase:'https://m5o.pivotalweather.com/maps/models/hrrr/2026092312', product:'snod-imp', start:0, end:48, step:1, description:'HRRR updates hourly with the newest radar and satellite data. It is your tactical near-term model when snow is about to begin or already falling.', action:'Follow heavy snow bands, squalls, and the hour precipitation ends.' }
};

const image = document.querySelector('#model-image');
const comparisonView = document.querySelector('#comparison-view');
const infoPanel = document.querySelector('#model-info');
const infoButton = document.querySelector('#info-button');
const loopControls = document.querySelector('#loop-controls');
const playButton = document.querySelector('#play-button');
const previousButton = document.querySelector('#previous-button');
const nextButton = document.querySelector('#next-button');
const singleTimeline = document.querySelector('#single-timeline');
const comparisonTimelines = document.querySelector('#comparison-timelines');
const forecastSlider = document.querySelector('#forecast-slider');
const forecastHour = document.querySelector('#forecast-hour');
const frameCount = document.querySelector('#frame-count');
const speedControl = document.querySelector('#speed-control');
const speedValue = document.querySelector('#speed-value');
let activeModel = null;
let forecastHours = [];
let animationId = null;
let nbmRun = null;
let nbmRunRequest = null;

const comparisonTracks = [
  { image:document.querySelector('#ecmwf-image'), mapHour:document.querySelector('#ecmwf-map-hour'), slider:document.querySelector('#ecmwf-slider'), hour:document.querySelector('#ecmwf-hour'), count:document.querySelector('#ecmwf-count'), model:null, hours:[] },
  { image:document.querySelector('#aifs-image'), mapHour:document.querySelector('#aifs-map-hour'), slider:document.querySelector('#aifs-slider'), hour:document.querySelector('#aifs-hour'), count:document.querySelector('#aifs-count'), model:null, hours:[] }
];

const loopIntervals = [1500, 1250, 1000, 800, 650, 500, 350, 220, 120, 60];

function padHour(hour) { return String(hour).padStart(3, '0'); }

function getLoopInterval() {
  return loopIntervals[Number(speedControl.value) - 1];
}

function renderSpeedValue() {
  const seconds = (getLoopInterval() / 1000).toFixed(2);
  speedValue.textContent = `${seconds}s`;
  speedControl.setAttribute('aria-valuetext', `${seconds} seconds per frame`);
}

function getPsuRunCandidates() {
  const latestCycle = new Date();
  latestCycle.setUTCMinutes(0, 0, 0);
  latestCycle.setUTCHours(Math.floor(latestCycle.getUTCHours() / 6) * 6);
  return Array.from({ length: 5 }, (_, index) => {
    const run = new Date(latestCycle.getTime() - index * 6 * 60 * 60 * 1000);
    return `${run.getUTCFullYear()}${String(run.getUTCMonth() + 1).padStart(2, '0')}${String(run.getUTCDate()).padStart(2, '0')}${String(run.getUTCHours()).padStart(2, '0')}`;
  });
}

function imageExists(url) {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = url;
  });
}

async function loadLatestNbmRun() {
  if (nbmRun) return nbmRun;
  if (nbmRunRequest) return nbmRunRequest;
  nbmRunRequest = (async () => {
    for (const run of getPsuRunCandidates()) {
      const probeUrl = `${models.nbm.imageBase}/${run}/nbm.${models.nbm.product}.${models.nbm.region}.f${models.nbm.start}.png`;
      if (await imageExists(probeUrl)) {
        nbmRun = run;
        return run;
      }
    }
    throw new Error('No recent Penn State NBM run is available.');
  })();
  try {
    return await nbmRunRequest;
  } finally {
    nbmRunRequest = null;
  }
}

function getForecastImageUrl(model, hour) {
  if (model.source === 'psu-nbm') {
    return `${model.imageBase}/${nbmRun}/nbm.${model.product}.${model.region}.f${hour}.png`;
  }
  return `${model.imageBase}/${padHour(hour)}/${model.product}.us_ma.png`;
}

function getForecastHours(model) {
  const hours = [];
  for (let hour = model.start; hour <= model.end; hour += model.step) hours.push(hour);
  return hours;
}

function stopLoop() {
  window.clearInterval(animationId);
  animationId = null;
  playButton.textContent = '▶';
  playButton.setAttribute('aria-label', 'Play forecast loop');
}

function renderForecastFrame() {
  const index = Number(forecastSlider.value);
  const hour = forecastHours[index];
  if (!activeModel || hour === undefined || (activeModel.source === 'psu-nbm' && !nbmRun)) return;
  image.src = getForecastImageUrl(activeModel, hour);
  forecastHour.textContent = `F${padHour(hour)}`;
  frameCount.textContent = `${index + 1} / ${forecastHours.length}`;
}

function renderComparisonFrames() {
  comparisonTracks.forEach((track) => {
    const index = Number(track.slider.value);
    const hour = track.hours[index];
    if (hour === undefined) return;
    track.image.src = getForecastImageUrl(track.model, hour);
    track.hour.textContent = `F${padHour(hour)}`;
    track.mapHour.textContent = `F${padHour(hour)}`;
    track.count.textContent = `${index + 1} / ${track.hours.length}`;
  });
}

function syncComparisonToPrimary() {
  const primary = comparisonTracks[0];
  const primaryIndex = Number(primary.slider.value);
  const progress = primary.hours.length > 1 ? primaryIndex / (primary.hours.length - 1) : 0;
  comparisonTracks.slice(1).forEach((track) => {
    track.slider.value = String(Math.round(progress * (track.hours.length - 1)));
  });
  renderComparisonFrames();
}

function stepFrame(direction) {
  stopLoop();
  if (activeModel.comparison) {
    const primary = comparisonTracks[0];
    const nextIndex = (Number(primary.slider.value) + direction + primary.hours.length) % primary.hours.length;
    primary.slider.value = String(nextIndex);
    syncComparisonToPrimary();
    return;
  }
  const nextIndex = (Number(forecastSlider.value) + direction + forecastHours.length) % forecastHours.length;
  forecastSlider.value = String(nextIndex);
  renderForecastFrame();
}

function startLoop() {
  stopLoop();
  if (activeModel.comparison) syncComparisonToPrimary();
  animationId = window.setInterval(() => {
    if (activeModel.comparison) {
      const primary = comparisonTracks[0];
      primary.slider.value = String((Number(primary.slider.value) + 1) % primary.hours.length);
      syncComparisonToPrimary();
    } else {
      const nextIndex = (Number(forecastSlider.value) + 1) % forecastHours.length;
      forecastSlider.value = String(nextIndex);
      renderForecastFrame();
    }
  }, getLoopInterval());
  playButton.textContent = '❚❚';
  playButton.setAttribute('aria-label', 'Pause forecast loop');
}

function showModel(key) {
  const model = models[key];
  stopLoop();
  activeModel = model;
  const isComparison = model.comparison === true;
  document.body.classList.toggle('is-comparison', isComparison);
  image.hidden = isComparison;
  comparisonView.hidden = !isComparison;
  singleTimeline.hidden = isComparison;
  comparisonTimelines.hidden = !isComparison;
  loopControls.hidden = false;
  document.body.classList.add('has-loop');
  if (isComparison) {
    comparisonTracks.forEach((track, index) => {
      track.model = model.members[index];
      track.hours = getForecastHours(track.model);
      track.slider.min = '0';
      track.slider.max = String(track.hours.length - 1);
      track.slider.value = '0';
      track.image.alt = `${track.model.name} snowfall model map`;
    });
    playButton.disabled = false;
    renderComparisonFrames();
  } else {
    forecastHours = getForecastHours(model);
    forecastSlider.min = '0';
    forecastSlider.max = String(forecastHours.length - 1);
    forecastSlider.value = '0';
  }
  if (!isComparison && model.source === 'psu-nbm' && !nbmRun) {
    image.removeAttribute('src');
    forecastHour.textContent = 'Loading';
    frameCount.textContent = `1 / ${forecastHours.length}`;
    playButton.disabled = true;
    loadLatestNbmRun().then(() => {
      if (activeModel === model) {
        playButton.disabled = false;
        renderForecastFrame();
      }
    }).catch(() => {
      if (activeModel === model) {
        forecastHour.textContent = 'Unavailable';
        frameCount.textContent = '—';
      }
    });
  } else if (!isComparison) {
    playButton.disabled = false;
    renderForecastFrame();
  }
  image.alt = `${model.name} weather model map`;
  document.querySelector('#active-model-name').textContent = model.name;
  document.querySelector('#active-model-phase').textContent = model.phase;
  document.querySelector('#info-phase').textContent = model.phaseLabel;
  document.querySelector('#info-name').textContent = model.name;
  document.querySelector('#info-description').textContent = model.description;
  document.querySelector('#info-action').textContent = model.action;
  document.querySelectorAll('.model-choice').forEach((choice) => {
    const selected = choice.dataset.model === key;
    choice.classList.toggle('is-active', selected);
    choice.setAttribute('aria-current', String(selected));
  });
}

document.querySelectorAll('.model-choice').forEach((choice) => choice.addEventListener('click', () => showModel(choice.dataset.model)));
infoButton.addEventListener('click', () => {
  const open = infoPanel.hidden;
  infoPanel.hidden = !open;
  infoButton.setAttribute('aria-expanded', String(open));
});
forecastSlider.addEventListener('input', () => { stopLoop(); renderForecastFrame(); });
comparisonTracks.forEach((track) => track.slider.addEventListener('input', () => { stopLoop(); renderComparisonFrames(); }));
playButton.addEventListener('click', () => { if (animationId) stopLoop(); else startLoop(); });
previousButton.addEventListener('click', () => stepFrame(-1));
nextButton.addEventListener('click', () => stepFrame(1));
speedControl.addEventListener('input', () => {
  renderSpeedValue();
  if (animationId) startLoop();
});

renderSpeedValue();
showModel('nbm');
