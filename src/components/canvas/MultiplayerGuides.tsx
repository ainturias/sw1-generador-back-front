import { useOthersConnectionIds } from "@liveblocks/react";
import { memo } from "react";
import Cursor from "./Cursor";

export default memo(function MultiplayerGuides() {
  const ids = useOthersConnectionIds();

  return (
    <>
      {ids.map((connectionId) => (
        <Cursor key={connectionId} connectionId={connectionId} />
      ))}
    </>
  );
});
