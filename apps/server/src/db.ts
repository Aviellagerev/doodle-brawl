import {Pool} from "pg";
import {config} from "./config.js";

export const pool = new Pool({...config.postgres})
pool.on("connect",()=>console.log("🟢 Connected to Postgress"));
pool.on("error", (err) => console.error("🔴 Postgress Error:", err));