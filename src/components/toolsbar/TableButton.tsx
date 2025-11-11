import { AiOutlineTable } from "react-icons/ai";
import IconButton from "./IconButton";

export default function TableButton({
  isActive,
  onClick,
}: {
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <IconButton isActive={isActive} onClick={onClick}>
      <AiOutlineTable className="h-5 w-5" />
    </IconButton>
  );
}