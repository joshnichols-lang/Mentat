import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MyWallets } from "./MyWallets";

interface MyWalletsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyWalletsModal({ open, onOpenChange }: MyWalletsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="dialog-my-wallets">
        <DialogHeader>
          <DialogTitle>My Wallets</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <MyWallets />
        </div>
      </DialogContent>
    </Dialog>
  );
}
