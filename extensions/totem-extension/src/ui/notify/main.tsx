import "../../core/storage/typedStorage"; // runtime chrome.storage.*.getTyped (must run first)
import React from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { Notify } from "./notify";
import { bootstrapPopupTheme } from '../theme/popupThemeBootstrap';

bootstrapPopupTheme();
createRoot(document.getElementById("root")!).render(<Notify />);