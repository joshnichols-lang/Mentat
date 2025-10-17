import { useQuery } from "@tanstack/react-query";

interface CredentialsStatus {
  hasCredentials: boolean;
  encryptionMethod?: string;
}

export function useCredentials() {
  const { data, isLoading, error, isSuccess } = useQuery<CredentialsStatus>({
    queryKey: ["/api/credentials/status"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    hasCredentials: isSuccess ? data.hasCredentials : false,
    isLoading,
    error,
    isSuccess,
  };
}
