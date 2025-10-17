import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

interface VolumeProfileChartSimpleProps {
  coin: string;
}

export default function VolumeProfileChartSimple({ coin }: VolumeProfileChartSimpleProps) {
  // Fetch volume profile data - minimal version for testing
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/indicators/volume-profile/${coin}`],
    refetchInterval: 5000,
  });

  console.log('[VolumeProfile] Component mounted, coin:', coin);
  console.log('[VolumeProfile] Query state:', { data, isLoading, error });

  return (
    <Card className="p-4" data-testid="card-volume-profile-simple">
      <h3 className="text-sm font-bold mb-2">Volume Profile Test - {coin}</h3>
      <div className="text-xs">
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
        <div>Error: {error ? String(error) : 'None'}</div>
        <div>Data: {data ? 'Received' : 'None'}</div>
      </div>
    </Card>
  );
}
