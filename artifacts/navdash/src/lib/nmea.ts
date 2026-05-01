import { NavigationData, AISTarget } from "./signalk";

export function nmeaChecksum(sentence: string): boolean {
  const match = sentence.match(/^\$(.*)\*([0-9A-Fa-f]{2})$/);
  if (!match) return true;
  let check = 0;
  for (const c of match[1]) check ^= c.charCodeAt(0);
  return check === parseInt(match[2], 16);
}

function parseLatLon(latStr: string, latDir: string, lonStr: string, lonDir: string) {
  if (!latStr || !lonStr) return null;
  const latDeg = parseFloat(latStr.substring(0, 2));
  const latMin = parseFloat(latStr.substring(2));
  const lonDeg = parseFloat(lonStr.substring(0, 3));
  const lonMin = parseFloat(lonStr.substring(3));
  if (isNaN(latDeg) || isNaN(latMin) || isNaN(lonDeg) || isNaN(lonMin)) return null;
  let lat = latDeg + latMin / 60;
  let lon = lonDeg + lonMin / 60;
  if (latDir === "S") lat = -lat;
  if (lonDir === "W") lon = -lon;
  return { latitude: lat, longitude: lon };
}

function knotsToMps(kn: number): number {
  return kn * 0.514444;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export interface NMEAParseResult {
  nav?: Partial<NavigationData>;
  ais?: Partial<AISTarget> & { mmsi: string };
  raw?: string;
}

export function parseNMEASentence(sentence: string): NMEAParseResult | null {
  const s = sentence.trim();
  if (!s.startsWith("$") && !s.startsWith("!")) return null;

  const talkerSentence = s.startsWith("!") ? s.substring(1) : s.substring(1);
  const parts = talkerSentence.split(",");
  if (parts.length < 2) return null;

  const tag = parts[0];
  const sentenceId = tag.length >= 5 ? tag.substring(tag.length - 3) : tag;

  switch (sentenceId) {
    case "RMC": {
      const status = parts[2];
      if (status !== "A") return { raw: s };
      const pos = parseLatLon(parts[3], parts[4], parts[5], parts[6]);
      const sogKn = parseFloat(parts[7]);
      const cogDeg = parseFloat(parts[8]);
      const result: Partial<NavigationData> = {};
      if (pos) result.position = pos;
      if (!isNaN(sogKn)) result.speedOverGround = knotsToMps(sogKn);
      if (!isNaN(cogDeg)) result.courseOverGroundTrue = degToRad(cogDeg);
      return { nav: result, raw: s };
    }

    case "GGA": {
      const fixQuality = parseInt(parts[6]);
      if (fixQuality === 0) return { raw: s };
      const pos = parseLatLon(parts[2], parts[3], parts[4], parts[5]);
      const result: Partial<NavigationData> = {};
      if (pos) result.position = pos;
      return { nav: result, raw: s };
    }

    case "GLL": {
      const status = parts[6];
      if (status && status !== "A") return { raw: s };
      const pos = parseLatLon(parts[1], parts[2], parts[3], parts[4]);
      if (!pos) return { raw: s };
      return { nav: { position: pos }, raw: s };
    }

    case "VTG": {
      const cogTrue = parseFloat(parts[1]);
      const cogMag = parseFloat(parts[3]);
      const sogKn = parseFloat(parts[7]);
      const result: Partial<NavigationData> = {};
      if (!isNaN(cogTrue)) result.courseOverGroundTrue = degToRad(cogTrue);
      if (!isNaN(cogMag)) result.courseOverGroundMagnetic = degToRad(cogMag);
      if (!isNaN(sogKn)) result.speedOverGround = knotsToMps(sogKn);
      return { nav: result, raw: s };
    }

    case "HDG": {
      const hdgMag = parseFloat(parts[1]);
      const variation = parseFloat(parts[4]);
      const varDir = parts[5]?.replace(/\*.*/, "").trim();
      const result: Partial<NavigationData> = {};
      if (!isNaN(hdgMag)) result.headingMagnetic = degToRad(hdgMag);
      if (!isNaN(variation)) {
        const v = varDir === "W" ? -variation : variation;
        result.magneticVariation = degToRad(v);
        if (!isNaN(hdgMag)) result.headingTrue = degToRad(hdgMag + v);
      }
      return { nav: result, raw: s };
    }

    case "HDM": {
      const hdgMag = parseFloat(parts[1]);
      if (isNaN(hdgMag)) return null;
      return { nav: { headingMagnetic: degToRad(hdgMag) }, raw: s };
    }

    case "HDT": {
      const hdgTrue = parseFloat(parts[1]);
      if (isNaN(hdgTrue)) return null;
      return { nav: { headingTrue: degToRad(hdgTrue) }, raw: s };
    }

    case "MWV": {
      const angle = parseFloat(parts[1]);
      const ref = parts[2];
      const speedVal = parseFloat(parts[3]);
      const unit = parts[4];
      const status = parts[5]?.replace(/\*.*/, "").trim();
      if (status !== "A" && status) return { raw: s };
      if (isNaN(angle) || isNaN(speedVal)) return null;

      let speedMps = speedVal;
      if (unit === "K") speedMps = speedVal / 3.6;
      else if (unit === "N") speedMps = knotsToMps(speedVal);

      if (ref === "R") {
        return { nav: { windAngleApparent: degToRad(angle), windSpeedApparent: speedMps }, raw: s };
      } else {
        return { nav: { windAngleTrue: degToRad(angle), windSpeedTrue: speedMps }, raw: s };
      }
    }

    case "MWD": {
      const dirTrue = parseFloat(parts[1]);
      const speedKn = parseFloat(parts[5]);
      const speedMs = parseFloat(parts[7]?.replace(/\*.*/, ""));
      const result: Partial<NavigationData> = {};
      if (!isNaN(dirTrue)) result.windAngleTrue = degToRad(dirTrue);
      if (!isNaN(speedMs)) result.windSpeedTrue = speedMs;
      else if (!isNaN(speedKn)) result.windSpeedTrue = knotsToMps(speedKn);
      return { nav: result, raw: s };
    }

    case "VHW": {
      const hdgTrue = parseFloat(parts[1]);
      const hdgMag = parseFloat(parts[3]);
      const stwKn = parseFloat(parts[5]);
      const result: Partial<NavigationData> = {};
      if (!isNaN(hdgTrue)) result.headingTrue = degToRad(hdgTrue);
      if (!isNaN(hdgMag)) result.headingMagnetic = degToRad(hdgMag);
      if (!isNaN(stwKn)) result.speedThroughWater = knotsToMps(stwKn);
      return { nav: result, raw: s };
    }

    case "DBT": {
      const depthFt = parseFloat(parts[1]);
      const depthM = parseFloat(parts[3]);
      if (!isNaN(depthM)) return { nav: { depthBelowKeel: depthM }, raw: s };
      if (!isNaN(depthFt)) return { nav: { depthBelowKeel: depthFt * 0.3048 }, raw: s };
      return null;
    }

    case "DBS": {
      const depthM = parseFloat(parts[3]);
      const depthFt = parseFloat(parts[1]);
      if (!isNaN(depthM)) return { nav: { depthBelowSurface: depthM }, raw: s };
      if (!isNaN(depthFt)) return { nav: { depthBelowSurface: depthFt * 0.3048 }, raw: s };
      return null;
    }

    case "DBK": {
      const depthM = parseFloat(parts[3]);
      const depthFt = parseFloat(parts[1]);
      if (!isNaN(depthM)) return { nav: { depthBelowKeel: depthM }, raw: s };
      if (!isNaN(depthFt)) return { nav: { depthBelowKeel: depthFt * 0.3048 }, raw: s };
      return null;
    }

    case "DPT": {
      const depthM = parseFloat(parts[1]);
      const offset = parseFloat(parts[2]);
      if (isNaN(depthM)) return null;
      const d = !isNaN(offset) ? depthM - offset : depthM;
      return { nav: { depthBelowKeel: d > 0 ? d : depthM }, raw: s };
    }

    case "MTW": {
      const tempC = parseFloat(parts[1]);
      const unit = parts[2]?.replace(/\*.*/, "").trim();
      if (isNaN(tempC)) return null;
      const tempK = unit === "F" ? ((tempC - 32) * 5) / 9 + 273.15 : tempC + 273.15;
      return { nav: { waterTemperature: tempK }, raw: s };
    }

    case "VLW": {
      const totalNM = parseFloat(parts[1]);
      const tripNM = parseFloat(parts[3]);
      const result: Partial<NavigationData> = {};
      if (!isNaN(totalNM)) result.logTotal = totalNM * 1852;
      if (!isNaN(tripNM)) result.logTrip = tripNM * 1852;
      return { nav: result, raw: s };
    }

    case "VDM":
    case "VDO": {
      const fillBits = parseInt(parts[4] ?? "0");
      const payload = parts[5];
      if (!payload) return null;
      const aisResult = decodeAISPayload(payload, fillBits);
      if (aisResult) return { ais: aisResult, raw: s };
      return { raw: s };
    }

    case "RSA": {
      // Rudder Sensor Angle. parts[1] = starboard rudder angle (deg),
      // parts[2] = status A/V, parts[3] = port rudder angle, parts[4] = status.
      // Positive = bow turning to starboard.
      const angleStarboard = parseFloat(parts[1]);
      const statusS = parts[2];
      const angleStrip = (s: string | undefined) => parseFloat((s ?? "").replace(/\*.*/, ""));
      const anglePort = angleStrip(parts[3]);
      const statusP = parts[4]?.replace(/\*.*/, "").trim();
      let chosen: number | undefined;
      if (!isNaN(angleStarboard) && (statusS === "A" || !statusS)) chosen = angleStarboard;
      else if (!isNaN(anglePort) && (statusP === "A" || !statusP)) chosen = anglePort;
      if (chosen === undefined) return { raw: s };
      return { nav: { rudderAngle: degToRad(chosen) }, raw: s };
    }

    case "MDA": {
      // Meteorological Composite. Many fields; pick the useful ones.
      // 1: pressure inches Hg, 2: "I", 3: pressure bars, 4: "B"
      // 5: air temp C, 6: "C", 7: water temp C, 8: "C"
      // 9: relative humidity %, 10: absolute humidity %, 11: dew point C, 12: "C"
      // 13: wind dir true, 14: "T", 15: wind dir mag, 16: "M"
      // 17: wind speed kn, 18: "N", 19: wind speed m/s, 20: "M"
      const pressureBar = parseFloat(parts[3]);
      const airTempC = parseFloat(parts[5]);
      const waterTempC = parseFloat(parts[7]);
      const humidity = parseFloat(parts[9]);
      const dewPointC = parseFloat(parts[11]);
      const windDirTrue = parseFloat(parts[13]);
      const windSpeedMs = parseFloat(parts[19]);
      const windSpeedKn = parseFloat(parts[17]);
      const result: Partial<NavigationData> = {};
      if (!isNaN(pressureBar)) result.atmosphericPressure = pressureBar * 100000; // bar -> Pa
      if (!isNaN(airTempC)) result.airTemperature = airTempC + 273.15;
      if (!isNaN(waterTempC)) result.waterTemperature = waterTempC + 273.15;
      if (!isNaN(humidity)) result.humidityRelative = humidity;
      if (!isNaN(dewPointC)) result.dewPoint = dewPointC + 273.15;
      if (!isNaN(windDirTrue)) result.windAngleTrue = degToRad(windDirTrue);
      if (!isNaN(windSpeedMs)) result.windSpeedTrue = windSpeedMs;
      else if (!isNaN(windSpeedKn)) result.windSpeedTrue = knotsToMps(windSpeedKn);
      return Object.keys(result).length ? { nav: result, raw: s } : { raw: s };
    }

    case "VDR": {
      // Set and Drift (current). 1: set true (deg), 2: T, 3: set mag (deg), 4: M,
      // 5: drift speed (kn), 6: N
      const setTrue = parseFloat(parts[1]);
      const driftKn = parseFloat((parts[5] ?? "").replace(/\*.*/, ""));
      const result: Partial<NavigationData> = {};
      if (!isNaN(setTrue)) result.currentSet = degToRad(setTrue);
      if (!isNaN(driftKn)) result.currentDrift = knotsToMps(driftKn);
      return Object.keys(result).length ? { nav: result, raw: s } : { raw: s };
    }

    case "ZDA": {
      // Time and date. 1: hhmmss.ss UTC, 2: day, 3: month, 4: year, 5: tz hr, 6: tz min
      const hhmmss = parts[1];
      const day = parseInt(parts[2]);
      const month = parseInt(parts[3]);
      const year = parseInt(parts[4]);
      if (!hhmmss || isNaN(day) || isNaN(month) || isNaN(year)) return { raw: s };
      const hh = hhmmss.substring(0, 2);
      const mm = hhmmss.substring(2, 4);
      const ss = hhmmss.substring(4);
      const iso = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}T${hh}:${mm}:${ss}Z`;
      return { nav: { gpsTimeUTC: iso }, raw: s };
    }

    case "GSA": {
      // GPS DOP and active satellites. 1: mode (M/A), 2: fix type (1/2/3), 3-14: PRNs,
      // 15: PDOP, 16: HDOP, 17: VDOP
      const fixType = parseInt(parts[2]);
      const pdop = parseFloat(parts[15]);
      const hdop = parseFloat(parts[16]);
      const vdop = parseFloat((parts[17] ?? "").replace(/\*.*/, ""));
      const result: Partial<NavigationData> = {};
      if (fixType === 1) result.gpsFixType = "none";
      else if (fixType === 2) result.gpsFixType = "2D";
      else if (fixType === 3) result.gpsFixType = "3D";
      if (!isNaN(pdop)) result.gpsPdop = pdop;
      if (!isNaN(hdop)) result.gpsHdop = hdop;
      if (!isNaN(vdop)) result.gpsVdop = vdop;
      // Count active satellite PRNs in fields 3..14
      let used = 0;
      for (let i = 3; i <= 14; i++) {
        if (parts[i] && parts[i].length > 0) used++;
      }
      if (used > 0) result.gpsSatellitesUsed = used;
      return Object.keys(result).length ? { nav: result, raw: s } : { raw: s };
    }

    case "GSV": {
      // Satellites in View. 1: total messages, 2: msg num, 3: total satellites in view
      const totalSats = parseInt(parts[3]);
      if (isNaN(totalSats)) return { raw: s };
      return { nav: { gpsSatellitesInView: totalSats }, raw: s };
    }

    default:
      // Recognise but do not parse some common proprietary sentences so the
      // diagnostics view shows them as "received but intentionally ignored".
      // PDGY = Digital Yacht status, PRDID = various, etc.
      if (sentenceId === "DGY" || tag.startsWith("P")) {
        return { raw: s };
      }
      return null;
  }
}

function decodeAISPayload(payload: string, fillBits: number): (Partial<AISTarget> & { mmsi: string }) | null {
  try {
    const bits = armstrongDecode(payload, fillBits);
    const msgType = getBits(bits, 0, 6);
    if (msgType < 1 || msgType > 27) return null;

    const mmsiNum = getBits(bits, 8, 38);
    const mmsi = mmsiNum.toString().padStart(9, "0");

    if (msgType <= 3) {
      const status = getBits(bits, 38, 42);
      const sogRaw = getBits(bits, 50, 60);
      const lonRaw = getBitsSignedSigned(bits, 61, 89);
      const latRaw = getBitsSignedSigned(bits, 89, 116);
      const cogRaw = getBits(bits, 116, 128);
      const hdgRaw = getBits(bits, 128, 137);

      const sog = sogRaw !== 1023 ? sogRaw / 10 : undefined;
      const lon = lonRaw !== 0x6791AC0 ? lonRaw / 600000 : undefined;
      const lat = latRaw !== 0x3412140 ? latRaw / 600000 : undefined;
      const cog = cogRaw !== 3600 ? cogRaw / 10 : undefined;
      const hdg = hdgRaw !== 511 ? hdgRaw : undefined;

      const result: Partial<AISTarget> & { mmsi: string } = { mmsi };
      if (status !== undefined) result.status = status;
      if (sog !== undefined) result.sog = knotsToMps(sog);
      if (lon !== undefined && lat !== undefined) result.position = { latitude: lat, longitude: lon };
      if (cog !== undefined) result.cog = degToRad(cog);
      if (hdg !== undefined) result.heading = degToRad(hdg);
      return result;
    }

    if (msgType === 5) {
      const shipType = getBits(bits, 232, 240);
      const nameRaw = getTextBits(bits, 112, 232);
      const callsignRaw = getTextBits(bits, 70, 112);
      const dimA = getBits(bits, 240, 249);
      const dimB = getBits(bits, 249, 258);
      const dimC = getBits(bits, 258, 264);
      const dimD = getBits(bits, 264, 270);
      const length = dimA + dimB || undefined;
      const beam = dimC + dimD || undefined;

      return {
        mmsi,
        shipType: shipType || undefined,
        name: nameRaw?.trim() || undefined,
        callsign: callsignRaw?.trim() || undefined,
        length: length || undefined,
        beam: beam || undefined,
      };
    }

    if (msgType === 18) {
      const sogRaw = getBits(bits, 46, 56);
      const lonRaw = getBitsSignedSigned(bits, 57, 85);
      const latRaw = getBitsSignedSigned(bits, 85, 112);
      const cogRaw = getBits(bits, 112, 124);
      const hdgRaw = getBits(bits, 124, 133);

      const sog = sogRaw !== 1023 ? sogRaw / 10 : undefined;
      const lon = lonRaw !== 0x6791AC0 ? lonRaw / 600000 : undefined;
      const lat = latRaw !== 0x3412140 ? latRaw / 600000 : undefined;
      const cog = cogRaw !== 3600 ? cogRaw / 10 : undefined;
      const hdg = hdgRaw !== 511 ? hdgRaw : undefined;

      const result: Partial<AISTarget> & { mmsi: string } = { mmsi };
      if (sog !== undefined) result.sog = knotsToMps(sog);
      if (lon !== undefined && lat !== undefined) result.position = { latitude: lat, longitude: lon };
      if (cog !== undefined) result.cog = degToRad(cog);
      if (hdg !== undefined) result.heading = degToRad(hdg);
      return result;
    }

    if (msgType === 21) {
      const nameRaw = getTextBits(bits, 43, 163);
      const lonRaw = getBitsSignedSigned(bits, 164, 192);
      const latRaw = getBitsSignedSigned(bits, 192, 219);
      const lon = lonRaw !== 0x6791AC0 ? lonRaw / 600000 : undefined;
      const lat = latRaw !== 0x3412140 ? latRaw / 600000 : undefined;
      const result: Partial<AISTarget> & { mmsi: string } = { mmsi };
      if (nameRaw) result.name = nameRaw.trim();
      if (lon !== undefined && lat !== undefined) result.position = { latitude: lat, longitude: lon };
      return result;
    }

    return { mmsi };
  } catch {
    return null;
  }
}

const ARMSTR = "@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_ !\"#$%&'()*+,-./0123456789:;<=>?";

function armstrongDecode(payload: string, fillBits: number): number[] {
  const bits: number[] = [];
  for (const ch of payload) {
    let val = ch.charCodeAt(0) - 48;
    if (val > 39) val -= 8;
    for (let i = 5; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }
  return fillBits > 0 ? bits.slice(0, bits.length - fillBits) : bits;
}

function getBits(bits: number[], start: number, end: number): number {
  let val = 0;
  for (let i = start; i < end && i < bits.length; i++) {
    val = (val << 1) | bits[i];
  }
  return val;
}

function getBitsSignedSigned(bits: number[], start: number, end: number): number {
  const len = end - start;
  let val = getBits(bits, start, end);
  if (bits[start] === 1) {
    val = val - (1 << len);
  }
  return val;
}

function getTextBits(bits: number[], start: number, end: number): string {
  const chars: string[] = [];
  for (let i = start; i < end - 5; i += 6) {
    const code = getBits(bits, i, i + 6);
    chars.push(ARMSTR[code] ?? " ");
  }
  return chars.join("").replace(/@+$/, "").trim();
}
