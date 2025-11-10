import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onUploadComplete: (avatarUrl: string) => void;
  onRemove?: () => void;
  currentAvatarUrl?: string;
  className?: string;
}

export function ImageUpload({ onUploadComplete, onRemove, currentAvatarUrl, className }: ImageUploadProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview with currentAvatarUrl prop changes (for edit mode)
  useEffect(() => {
    if (currentAvatarUrl && currentAvatarUrl !== preview) {
      setPreview(currentAvatarUrl);
      setFile(null);
      setUploadSuccess(true);
    } else if (!currentAvatarUrl && preview) {
      // Parent cleared the avatar
      setPreview(null);
      setFile(null);
      setUploadSuccess(false);
    }
  }, [currentAvatarUrl]);

  const validateFile = (file: File): string | null => {
    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return "Only PNG, JPEG, and WebP images are allowed";
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return "Image must be less than 5MB";
    }

    return null;
  };

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Invalid image",
          description: error,
          variant: "destructive",
        });
        return;
      }

      setFile(file);
      setUploadSuccess(false);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select an image to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/strategy-avatars/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadSuccess(true);
      toast({
        title: "Upload successful",
        description: "Strategy avatar uploaded successfully",
      });

      // Call parent callback with avatar URL
      onUploadComplete(data.avatarUrl);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      setUploadSuccess(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Notify parent to clear avatarUrl
    onRemove?.();
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("w-full", className)} data-testid="component-image-upload">
      {/* Preview or upload area */}
      {preview ? (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative">
            <div className="relative w-full aspect-square max-w-xs mx-auto rounded-md overflow-hidden border border-white/20 bg-black">
              <img
                src={preview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
                data-testid="img-avatar-preview"
              />
            </div>

            {/* Remove button */}
            {!isUploading && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/80 hover:bg-black/90"
                onClick={handleRemove}
                data-testid="button-remove-image"
              >
                <X className="w-4 h-4" />
              </Button>
            )}

            {/* Success indicator */}
            {uploadSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="flex flex-col items-center gap-2 text-[#00FF41]">
                  <CheckCircle2 className="w-12 h-12" />
                  <span className="text-sm font-medium">Uploaded!</span>
                </div>
              </div>
            )}
          </div>

          {/* Upload button */}
          {file && !uploadSuccess && (
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full bg-[#00FF41] text-black hover:bg-[#00FF41]/90 border-[#00FF41]"
              data-testid="button-upload-image"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Avatar
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "relative w-full aspect-square max-w-xs mx-auto rounded-md border-2 border-dashed transition-colors cursor-pointer",
            isDragging
              ? "border-[#00FF41] bg-[#00FF41]/10"
              : "border-white/20 hover:border-white/40 bg-white/5"
          )}
          onClick={handleBrowse}
          data-testid="dropzone-image-upload"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
              isDragging ? "bg-[#00FF41]/20" : "bg-white/10"
            )}>
              <ImageIcon className={cn(
                "w-8 h-8 transition-colors",
                isDragging ? "text-[#00FF41]" : "text-white/50"
              )} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-white">
                {isDragging ? "Drop image here" : "Drag & drop an image"}
              </p>
              <p className="text-xs text-white/50">
                or click to browse
              </p>
            </div>

            <div className="text-xs text-white/40">
              PNG, JPEG, or WebP • Max 5MB
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileInput}
        className="hidden"
        data-testid="input-file-upload"
      />
    </div>
  );
}
