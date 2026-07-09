import React, { useState } from "react";

export function JsonView({ data, label="JSON" }:{ data:any; label?:string }) {
  const [open,setOpen]=useState(false);
  return (
    <div className="card">
      <button className="w-full text-left font-medium" onClick={()=>setOpen(!open)}>
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto text-xs leading-snug">
{JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}