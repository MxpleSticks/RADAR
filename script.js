const models = {
  nbm: { name:'NBM', phase:'All timeframes', phaseLabel:'ALL TIMEFRAMES · DECISION ANCHOR', embeddable:true, title:'NBM Northeast model wall', url:'https://mapwall.met.psu.edu/ewall/nbm/?panel1=model=nbm;region=NE;product=totalsnow;run=0&panel2=model=nbm;region=NE;product=temp;run=0&panel3=model=nbm;region=NE;product=totalprecip;run=0&panel4=model=nbm;region=NE;product=dew;run=0&panel5=model=nbm;region=NE;product=speed10m;run=0&panel6=model=nbm;region=NE;product=gust10m;run=0', description:'Keep NBM open as the ground-truth baseline. It blends many models, corrects known biases, and gives the most calibrated snowfall decision.', action:'Use it to anchor final accumulation expectations throughout the storm.' },
  ecmwf: { name:'ECMWF', phase:'3–10 days out', phaseLabel:'PHASE 01 · LONG-RANGE SETUP', title:'ECMWF snowfall model', imageBase:'https://m4o.pivotalweather.com/maps/models/ecmwf_full/2026092312', product:'sn10_006h-imp', start:6, end:240, step:6, description:'The traditional European model is your physics-based long-range anchor. Use it to establish the storm skeleton: track, cold air and moisture supply.', action:'Ask: coastal track for snow, or inland track for rain?' },
  aifs: { name:'ECMWF-AIFS', phase:'3–10 days out', phaseLabel:'PHASE 01 · LONG-RANGE CHECK', title:'ECMWF-AIFS snowfall model', imageBase:'https://m4o.pivotalweather.com/maps/models/ecmwf_aifs/2026092312', product:'sn10_006h-imp', start:6, end:360, step:6, description:'The AI European model is the traditional Euro’s pattern-recognition counterpart. Compare it directly with ECMWF before trusting a distant storm.', action:'Agreement raises confidence. Disagreement means the forecast is still uncertain.' },
  nam: { name:'NAM 3km', phase:'24–60 hours', phaseLabel:'PHASE 02 · REGIONAL DETAIL', title:'NAM 3km snowfall model', imageBase:'https://m4o.pivotalweather.com/maps/models/nam4km/2026092312', product:'snod-imp', start:1, end:60, step:1, description:'Use NAM’s finer grid once the storm is closer. It resolves terrain and local cold-air effects that broad global models smooth out.', action:'Locate the exact snow, sleet, freezing rain and rain transition zone.' },
  hrrr: { name:'HRRR', phase:'0–18 hours', phaseLabel:'PHASE 03 · GAME DAY', title:'HRRR snowfall model', imageBase:'https://m5o.pivotalweather.com/maps/models/hrrr/2026092312', product:'snod-imp', start:0, end:48, step:1, description:'HRRR updates hourly with the newest radar and satellite data. It is your tactical near-term model when snow is about to begin or already falling.', action:'Follow heavy snow bands, squalls, and the hour precipitation ends.' }
};

const frame = document.querySelector('#model-frame');
const image = document.querySelector('#model-image');
const infoPanel = document.querySelector('#model-info');
const infoButton = document.querySelector('#info-button');
const loopControls = document.querySelector('#loop-controls');
const playButton = document.querySelector('#play-button');
const forecastSlider = document.querySelector('#forecast-slider');
const forecastHour = document.querySelector('#forecast-hour');
const frameCount = document.querySelector('#frame-count');
const speedControl = document.querySelector('#speed-control');
let activeModel = null;
let forecastHours = [];
let animationId = null;

function padHour(hour) { return String(hour).padStart(3, '0'); }

function stopLoop() {
  window.clearInterval(animationId);
  animationId = null;
  playButton.textContent = '▶';
  playButton.setAttribute('aria-label', 'Play forecast loop');
}

function renderForecastFrame() {
  const index = Number(forecastSlider.value);
  const hour = forecastHours[index];
  image.src = `${activeModel.imageBase}/${padHour(hour)}/${activeModel.product}.us_ma.png`;
  forecastHour.textContent = `F${padHour(hour)}`;
  frameCount.textContent = `${index + 1} / ${forecastHours.length}`;
}

function startLoop() {
  stopLoop();
  animationId = window.setInterval(() => {
    const nextIndex = (Number(forecastSlider.value) + 1) % forecastHours.length;
    forecastSlider.value = String(nextIndex);
    renderForecastFrame();
  }, Number(speedControl.value));
  playButton.textContent = '❚❚';
  playButton.setAttribute('aria-label', 'Pause forecast loop');
}

function showModel(key) {
  const model = models[key];
  stopLoop();
  const canEmbed = model.embeddable === true;
  frame.hidden = !canEmbed;
  image.hidden = canEmbed;
  if (canEmbed) frame.src = model.url;
  else {
    activeModel = model;
    forecastHours = [];
    for (let hour = model.start; hour <= model.end; hour += model.step) forecastHours.push(hour);
    forecastSlider.min = '0';
    forecastSlider.max = String(forecastHours.length - 1);
    forecastSlider.value = '0';
    loopControls.hidden = false;
    document.body.classList.add('has-loop');
    renderForecastFrame();
  }
  if (canEmbed) {
    loopControls.hidden = true;
    document.body.classList.remove('has-loop');
  }
  frame.title = model.title;
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
playButton.addEventListener('click', () => { if (animationId) stopLoop(); else startLoop(); });
speedControl.addEventListener('change', () => { if (animationId) startLoop(); });
