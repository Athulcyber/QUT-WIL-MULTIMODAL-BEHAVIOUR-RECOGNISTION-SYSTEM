export interface IMemberBase {
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

export interface IMember extends IMemberBase {
  id: string;
}

export interface IMemberCreate extends IMemberBase {}
export interface IMemberUpdate extends Partial<IMemberBase> {}
