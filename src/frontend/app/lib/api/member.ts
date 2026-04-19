import { apiCore } from "./core";
import { IMember, IMemberCreate, IMemberUpdate } from "../interfaces";

const jsonify = async (response: Response) => {
  if (response.ok) {
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } else {
    throw {
      message: `Request failed with ${response.status}: ${response.statusText}`,
      code: response.status,
    };
  }
};

export const apiMember = {
  async getAllMembers(token: string): Promise<IMember[]> {
    const res = await fetch(`${apiCore.url}/members/`, {
      headers: apiCore.headers(token),
    });
    return await jsonify(res);
  },

  async createMember(token: string, data: IMemberCreate): Promise<IMember> {
    const res = await fetch(`${apiCore.url}/member/`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: apiCore.headers(token),
    });
    return await res.json();
  },

  async updateMember(token: string, id: string, data: IMemberUpdate): Promise<IMember> {
    const res = await fetch(`${apiCore.url}/member/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: apiCore.headers(token),
    });
    return await res.json();
  },

  async deleteMember(token: string, id: string): Promise<IMember> {
    const res = await fetch(`${apiCore.url}/member/${id}`, {
      method: "DELETE",
      headers: apiCore.headers(token),
    });
    return await res.json();
  },
};