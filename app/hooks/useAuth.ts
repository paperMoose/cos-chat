import { gql } from "@apollo/client";
import { useCallback, useState } from "react";
import { useQuery } from "@apollo/client";
import axios from "axios";
import { useEffect } from "react";
import { apiUrl, webappUrl } from "../utils/urls";
import { useNavigate } from "react-router-dom";

export const CURRENT_USER_QUERY = gql`
  query CommonQueryCurrentUser {
    currentUser {
      id
      email
      firstName
      lastName
      roles
      avatar
      otpVerified
      otpEnabled
    }
  }
`;

export type CurrentUserType = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roles?: Array<string | null> | null;
  avatar?: string | null;
  otpVerified: boolean;
  otpEnabled: boolean;
};

export const validateStatus = (status: number) => status >= 200 && status < 300;

export const client = axios.create({
  withCredentials: true,
  validateStatus,
});

// export const refreshToken = async () => {
//   const refreshUrl = apiUrl("/api/auth/token-refresh/");
//   const res = await client.post<void>(refreshUrl);
//   return res.data;
// };

export const useAuth = () => {
  const { data, loading, error, refetch } = useQuery(CURRENT_USER_QUERY, {
    onError: (apolloError) => {
      // refreshToken();
    },
  });

  const [hasCheckedUser, setHasCheckedUser] = useState(false);
  const isLoggedIn = Boolean(data?.currentUser);
  const currentUser = data?.currentUser || null;

  const logout = useCallback(async () => {
    try {
      // Use utility functions to construct URLs
      const logoutUrl = apiUrl("/api/auth/logout/");
      const loginUrl = webappUrl("/en/auth/login");

      // Perform logout operations and wait for them to complete
      await client.post<void>(logoutUrl);

      window.location.href = loginUrl;
    } catch (error) {
      console.error("Logout failed:", error);
      // Handle logout error (e.g., show a message to the user)
    }
  }, []); // Add navigate to the dependency array if you're using react-router-dom

  useEffect(() => {
    if (!loading) {
      setHasCheckedUser(true);
    }
  }, [loading]);

  useEffect(() => {
    if (hasCheckedUser && !isLoggedIn) {
      logout();
    }
  }, [hasCheckedUser, isLoggedIn, logout]);

  return {
    loading,
    error,
    isLoggedIn,
    currentUser,
    logout,
    refetch,
  };
};
