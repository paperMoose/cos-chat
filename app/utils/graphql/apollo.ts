import { apiUrl } from "@/app/utils/urls";
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const createApolloClient = () => {
  return new ApolloClient({
    ssrMode: typeof window === "undefined",
    link: new HttpLink({
      uri: apiUrl("/api/graphql/"), // Use apiUrl to construct the GraphQL endpoint URL
      credentials: "include",
    }),
    cache: new InMemoryCache(),
  });
};

export const apolloClient = createApolloClient();
