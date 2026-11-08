// Mock Supabase Client that redirects all calls to our local Node.js API
const API_URL = import.meta.env.PROD ? "/api" : "http://localhost:5000/api";

class QueryBuilder {
  constructor(public table: string, public method: string = "GET", public payload: any = null, public queryParams: any = {}) {}

  select(columns: string) {
    this.queryParams.select = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.queryParams[column] = `eq.${value}`;
    return this;
  }

  in(column: string, values: any[]) {
    this.queryParams[column] = `in.(${values.join(',')})`;
    return this;
  }

  order(column: string, options: { ascending?: boolean } = { ascending: true }) {
    this.queryParams.order = `${column}.${options.ascending ? 'asc' : 'desc'}`;
    return this;
  }

  insert(data: any) {
    this.method = "POST";
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.method = "PATCH";
    this.payload = data;
    return this;
  }

  delete() {
    this.method = "DELETE";
    return this;
  }

  single() {
    this.queryParams.single = true;
    return this;
  }

  limit(count: number) {
    this.queryParams.limit = count;
    return this;
  }

  // The actual fetch executor
  async then(resolve: any, reject: any) {
    try {
      const queryString = new URLSearchParams(this.queryParams).toString();
      const url = `${API_URL}/${this.table}?${queryString}`;
      const options: RequestInit = {
        method: this.method,
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': localStorage.getItem('session_id') || ''
        },
      };
      if (this.payload) {
        options.body = JSON.stringify(this.payload);
      }

      const res = await fetch(url, options);
      if (!res.ok) throw new Error(await res.text());
      let data = await res.json();
      
      // Handle .single() to match Supabase behavior (return object instead of array)
      if (this.queryParams.single && Array.isArray(data)) {
        data = data.length > 0 ? data[0] : null;
      }
      
      resolve({ data, error: null });
    } catch (error) {
      resolve({ data: null, error });
    }
  }
}

let authListeners: Array<(event: string, session: any) => void> = [];

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  rpc: async (func: string, args: any) => {
    try {
      const res = await fetch(`${API_URL}/rpc/${func}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args)
      });
      const data = await res.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  auth: {
    getUser: async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) return { data: { user: null }, error: null };
      try {
        const res = await fetch(`${API_URL}/auth/session`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          localStorage.removeItem("admin_token");
          return { data: { user: null }, error: null };
        }
        const data = await res.json();
        return { data: { user: data.user }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },
    updateUser: async () => ({ data: {}, error: null }),
    signOut: async () => {
      const token = localStorage.getItem("admin_token");
      if (token) {
        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch {}
        localStorage.removeItem("admin_token");
      }
      authListeners.forEach(cb => cb('SIGNED_OUT', null));
      return { error: null };
    },
    signInWithPassword: async ({ email, password }: any) => {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { data: null, error: new Error(data.error || "লগইন ব্যর্থ হয়েছে") };
        }
        localStorage.setItem("admin_token", data.token);
        const session = { user: data.user, access_token: data.token };
        authListeners.forEach(cb => cb('SIGNED_IN', session));
        return { data: { user: data.user, session }, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
    getSession: async () => {
      const token = localStorage.getItem("admin_token");
      if (!token) return { data: { session: null }, error: null };
      try {
        const res = await fetch(`${API_URL}/auth/session`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          localStorage.removeItem("admin_token");
          return { data: { session: null }, error: null };
        }
        const data = await res.json();
        const session = { user: data.user, access_token: token };
        return { data: { session }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
    },
    onAuthStateChange: (callback: any) => {
      authListeners.push(callback);
      const token = localStorage.getItem("admin_token");
      if (token) {
        fetch(`${API_URL}/auth/session`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(async res => {
          if (res.ok) {
            const data = await res.json();
            callback('SIGNED_IN', { user: data.user, access_token: token });
          } else {
            localStorage.removeItem("admin_token");
            callback('SIGNED_OUT', null);
          }
        }).catch(() => {
          callback('SIGNED_OUT', null);
        });
      } else {
        setTimeout(() => callback('SIGNED_OUT', null), 0);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners = authListeners.filter(cb => cb !== callback);
            }
          }
        }
      };
    }
  },
  functions: {
    invoke: async (name: string, args: any) => ({ data: {}, error: null })
  },
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          // data.secure_url is the returned path from our server.js upload endpoint
          return { data: { path: data.secure_url }, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      getPublicUrl: (path: string) => {
        // If the path is already a full URL or starts with /uploads, return it as is.
        // The mock upload method sets path to the data.secure_url from /api/upload.
        return { data: { publicUrl: path } };
      }
    })
  }
};