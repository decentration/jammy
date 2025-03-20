import {
    StatsStf,
    StatsInput,
    StatsState,
    StatsOutput,
  } from "../types";
  import { parseStatsInputJson, parseStatsStateJson, parseStatsOutputJson } from "./parseStatsJson";
  
  export function parseStatsStfJson(json: any): StatsStf {
    return {
      input: parseStatsInputJson(json.input),
      pre_state: parseStatsStateJson(json.pre_state),
      output: parseStatsOutputJson(json.output),
      post_state: parseStatsStateJson(json.post_state),
    };
  }
  