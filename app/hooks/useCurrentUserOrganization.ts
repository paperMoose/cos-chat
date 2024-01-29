import axios, { AxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../utils/urls";

export type OrgUserType = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  orgId: string;
};

export type UseCurrentUserOrganizationHook = {
  currentUserOrganization: OrgUserType | null;
  loading: boolean;
  error: AxiosError | null;
  refetch: () => Promise<void>;
};

export const useCurrentUserOrganization =
  (): UseCurrentUserOrganizationHook => {
    const [currentUserOrganization, setCurrentUserOrganization] =
      useState<OrgUserType | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<AxiosError | null>(null);
    const currentOrgUrl = apiUrl("/api/organizations/current-user/");

    const fetchCurrentUserOrganization = useCallback(async () => {
      setLoading(true);
      try {
        const response = await axios.get<OrgUserType>(currentOrgUrl, {
          withCredentials: true,
        });
        setCurrentUserOrganization(response.data);
      } catch (err) {
        setError(err as AxiosError);
      } finally {
        setLoading(false);
      }
    }, [currentOrgUrl]);

    useEffect(() => {
      fetchCurrentUserOrganization();
    }, [fetchCurrentUserOrganization]);

    return {
      currentUserOrganization,
      loading,
      error,
      refetch: fetchCurrentUserOrganization,
    };
  };
