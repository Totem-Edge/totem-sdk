import React from "react";

export function Card({children}:{children:React.ReactNode}){ 
  return <div className="card">{children}</div>; 
}

export function PrimaryButton(props:any){ 
  return <button {...props} className={"btn-primary w-full "+(props.className||"")} />; 
}