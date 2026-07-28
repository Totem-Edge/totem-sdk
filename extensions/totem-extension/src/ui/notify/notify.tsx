import React, { useEffect, useMemo, useState } from "react";
import { Card, PrimaryButton } from "../popup/components";
import { JsonView } from "../components/JsonView";

type Screen = "connect" | "tx";
type TxOutput = { address: string; amount: string; tokenId?: string; isChange?: boolean };
type TxInput  = { amount?: string; tokenId?: string; address?: string };
type TxPreview = {
  origin?: string;
  tokenId?: string;
  inputs?: TxInput[];
  outputs: TxOutput[];
  burn?: string;         // voluntary burn (fee) in MINIMA as string, or "0"
  witness?: any;         // parsed witness JSON if available
  raw?: string;          // raw txn hex if available
};

export function Notify(){
  const [screen,setScreen]=useState<Screen>("connect");
  const [payload,setPayload]=useState<any>(null);
  useEffect(()=>{
    chrome.runtime.sendMessage({type:"notify:init"}, (r) => { setScreen(r?.screen||"connect"); setPayload(r?.payload||null); });
  },[]);
  function approve(){ chrome.runtime.sendMessage({type:"notify:approve"}); window.close(); }
  function reject(){ chrome.runtime.sendMessage({type:"notify:reject"}); window.close(); }
  return (
    <div className="w-[380px] min-h-[560px] p-3 space-y-3">
      {screen==="connect" && <ConnectView onApprove={approve} onReject={reject} origin={payload?.origin} />}
      {screen==="tx" && <TxView onApprove={approve} onReject={reject} preview={payload?.preview} />}
    </div>
  );
}

function ConnectView({onApprove,onReject,origin}:{onApprove:()=>void;onReject:()=>void;origin?:string}){
  return (
    <Card>
      <div className="text-lg font-semibold mb-2">Connect request</div>
      <div className="text-sm text-neutral-300 mb-4 break-all">{origin||"Unknown site"}</div>
      <PrimaryButton onClick={onApprove}>Connect</PrimaryButton>
      <button className="mt-2 w-full py-2 text-sm text-neutral-400" onClick={onReject}>Cancel</button>
    </Card>
  );
}

function TxView({onApprove,onReject,preview}:{onApprove:()=>void;onReject:()=>void;preview:any}){
  const outs  = preview?.outputs || [];
  const inputs = preview?.inputs || [];
  const totalSend = useMemo(()=> outs.filter((o:any)=>!o.isChange).reduce((a:number,b:any)=>a+Number(b.amount||0),0),[outs]);
  const burn = preview?.burn ? Number(preview.burn) : 0;
  const deficit = preview?.deficit ? Number(preview.deficit) : 0;

  return (
    <>
      <Card>
        <div className="text-lg font-semibold mb-1">Confirm transaction</div>
        {preview?.origin && <div className="text-xs text-neutral-400 mb-2 break-all">Origin: {preview.origin}</div>}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Send total" value={`${fmt(totalSend)} MINIMA`} />
          {deficit > 0 ? (
            <Stat label="Deficit" value={`${fmt(deficit)} MINIMA`} />
          ) : (
            <Stat label="Burn (voluntary)" value={`${fmt(burn)} MINIMA`} />
          )}
          <Stat label="Inputs" value={String(inputs.length)} />
          <Stat label="Outputs" value={String(outs.length)} />
        </div>
      </Card>

      <Card>
        <div className="font-medium mb-2">Outputs</div>
        <div className="space-y-2">
          {outs.map((o:any,i:number)=>(
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="text-xs break-all">
                <div className="opacity-60">{o.isChange ? "Change" : "To"}</div>
                <div>{o.miniaddress || o.address}</div>
                {o.miniaddress && o.address && <div className="opacity-60">{o.address}</div>}
              </div>
              <div className="text-sm font-semibold whitespace-nowrap">{fmt(Number(o.amount))} MINIMA</div>
            </div>
          ))}
        </div>
      </Card>

      {preview?.witness && <JsonView data={preview.witness} label="Witness (JSON)" />}
      {preview?.raw && <JsonView data={preview.raw} label="Raw Tx (HEX)" />}

      <div className="grid grid-cols-2 gap-2">
        <button className="input hover:bg-white/10" onClick={onReject}>Reject</button>
        <PrimaryButton onClick={onApprove} disabled={deficit>0}>Approve & Send</PrimaryButton>
      </div>
      {deficit>0 && <div className="hint mt-2">This transaction has no inputs yet (deficit). Add inputs/coinselect (e.g., <code>txnauto</code>) or reduce the amount.</div>}
    </>
  );
}

function Stat({label,value}:{label:string;value:string}) {
  return (
    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
      <div className="text-[10px] opacity-70">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function fmt(n:number){ return (Number.isFinite(n)? n : 0).toLocaleString(undefined,{ maximumFractionDigits: 8 }); }