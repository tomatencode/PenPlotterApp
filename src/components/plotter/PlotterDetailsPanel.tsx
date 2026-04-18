interface PlotterInfo {
  name: string;
  mdnsName: string;
  iteration: number;
  firmwareVersion: string;
  workspaceX: number;
  workspaceY: number;
}

interface Props {
  info: PlotterInfo | null;
  url: string;
}

export default function PlotterDetailsPanel({ info, url }: Props) {
  const rows = [
    { label: "Iteration", value: info ? `V${info.iteration}` : "—"                          },
    { label: "Firmware",  value: info?.firmwareVersion ?? "—"                                },
    { label: "mDNS Name", value: info ? `${info.mdnsName}.local` : "—"                      },
    { label: "URL",       value: url                                                          },
    { label: "Workspace", value: info ? `${info.workspaceX} × ${info.workspaceY} mm` : "—"  },
  ];

  return (
    <div className="px-4 py-4 flex flex-col gap-3.5">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Details</p>
      {rows.map(({ label, value }) => (
        <div key={label}>
          <p className="text-xs text-slate-600 mb-0.5">{label}</p>
          <p className="text-sm text-slate-300 font-mono truncate" title={value}>{value}</p>
        </div>
      ))}
    </div>
  );
}

export type { PlotterInfo };
