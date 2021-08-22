import type {
  DispatchError,
  DispatchInfo,
  EventRecord,
  Extrinsic,
} from "@polkadot/types/interfaces";
import type { TxWithEvent } from "@polkadot/api-derive/types";

export function mapExtrinsics(extrinsics: Extrinsic[], records: EventRecord[]): TxWithEvent[] {
  return extrinsics.map((extrinsic, index): TxWithEvent => {
    let dispatchError: DispatchError | undefined;
    let dispatchInfo: DispatchInfo | undefined;

    const events = records
      .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
      .map(({ event }) => {
        if (event.section === "system") {
          if (event.method === "ExtrinsicSuccess") {
            dispatchInfo = event.data[0] as DispatchInfo;
          } else if (event.method === "ExtrinsicFailed") {
            dispatchError = event.data[0] as DispatchError;
            dispatchInfo = event.data[1] as DispatchInfo;
          }
        }

        return event;
      });

    return { dispatchError, dispatchInfo, events, extrinsic };
  });
}
