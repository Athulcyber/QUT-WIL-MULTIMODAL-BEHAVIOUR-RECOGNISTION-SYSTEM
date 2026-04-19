"use client";

import { useState, useEffect, Suspense } from "react";
import { useAppDispatch, useAppSelector } from "../lib/hooks";
import { loggedIn, isAdmin } from "../lib/slices/authSlice";
import { RootState } from "../lib/store";
import { token } from "../lib/slices/tokensSlice";
import { addNotice } from "../lib/slices/toastsSlice";
import { apiMember } from "../lib/api/member";
import { IMember } from "../lib/interfaces/member";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  UsersIcon,
  UserIcon,
  SearchIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
} from "../components/ui/icons";
import AccessGuard from "../components/AccessGuard";

function UnsuspendedMembersPage() {
  const [members, setMembers] = useState<IMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<IMember | null>(null);
  const [formData, setFormData] = useState({ 
    first_name: "", 
    last_name: "", 
    date_of_birth: "",
    gender: "",
    health_conditions: [] as string[],
    new_condition: ""
  });
  
  const isLoggedIn = useAppSelector((state) => loggedIn(state));
  const isValidAdmin = useAppSelector((state: RootState) => isAdmin(state));
  const accessToken = useAppSelector((state) => token(state));
  const dispatch = useAppDispatch();

  const fetchMembers = async () => {
    try {
      const response = await apiMember.getAllMembers(accessToken);
      setMembers(Array.isArray(response) ? response : []);
    } catch (error) {
      dispatch(addNotice({
        title: "Error",
        content: "Failed to fetch residents",
        icon: "error"
      }));
      setMembers([]);
    }
  };

  useEffect(() => {
    if (isLoggedIn && isValidAdmin) {
      fetchMembers();
    }
  }, [isLoggedIn, isValidAdmin, accessToken]);

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
      health_conditions: [],
      new_condition: ""
    });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiMember.createMember(accessToken, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
      });
      dispatch(addNotice({
        title: "Success",
        content: "Resident added successfully"
      }));
      setShowAddDialog(false);
      resetForm();
      fetchMembers();
    } catch (error) {
      dispatch(addNotice({
        title: "Error",
        content: "Failed to add resident",
        icon: "error"
      }));
    }
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    
    try {
      await apiMember.updateMember(accessToken, selectedMember.id, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
      });
      dispatch(addNotice({
        title: "Success",
        content: "Resident updated successfully"
      }));
      setShowEditDialog(false);
      resetForm();
      setSelectedMember(null);
      fetchMembers();
    } catch (error) {
      dispatch(addNotice({
        title: "Error",
        content: "Failed to update resident",
        icon: "error"
      }));
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    
    try {
      await apiMember.deleteMember(accessToken, selectedMember.id);
      dispatch(addNotice({
        title: "Success",
        content: "Resident deleted successfully"
      }));
      setShowDeleteDialog(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (error) {
      dispatch(addNotice({
        title: "Error",
        content: "Failed to delete resident",
        icon: "error"
      }));
    }
  };

  const openEditDialog = (member: IMember) => {
    setSelectedMember(member);
    setFormData({
      first_name: member.first_name,
      last_name: member.last_name,
      date_of_birth: member.date_of_birth,
      gender: "",
      health_conditions: [],
      new_condition: ""
    });
    setShowEditDialog(true);
  };

  const openViewDialog = (member: IMember) => {
    setSelectedMember(member);
    setShowViewDialog(true);
  };

  const openDeleteDialog = (member: IMember) => {
    setSelectedMember(member);
    setShowDeleteDialog(true);
  };

  const addHealthCondition = () => {
    if (formData.new_condition.trim()) {
      setFormData({
        ...formData,
        health_conditions: [...formData.health_conditions, formData.new_condition.trim()],
        new_condition: ""
      });
    }
  };

  const removeHealthCondition = (index: number) => {
    setFormData({
      ...formData,
      health_conditions: formData.health_conditions.filter((_, i) => i !== index)
    });
  };

  const filteredMembers = members.filter(member =>
    `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <AccessGuard requireAdmin>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Resident Management</h1>
            <p className="mt-2 text-gray-500">Manage resident information and monitoring data</p>
          </div>
          {isValidAdmin && (
            <Button
            onClick={() => {
              resetForm();
              setShowAddDialog(true);
            }}
            className="bg-black text-white hover:bg-gray-800"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Resident
            </Button>
          )}
        </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="rounded-lg bg-blue-50 p-3">
              <UsersIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Residents</p>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="rounded-lg bg-green-50 p-3">
              <UserIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Monitoring</p>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resident Database Card */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Resident Database</h2>
            <p className="text-sm text-gray-500">Search and manage all registered residents</p>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name or resident ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* <TableHead>Resident ID</TableHead> */}
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Health Conditions</TableHead>
                  {/* <TableHead>Registered</TableHead> */}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      No residents found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      {/* <TableCell className="font-medium">{member.id}</TableCell> */}
                      <TableCell>{member.first_name} {member.last_name}</TableCell>
                      <TableCell>{calculateAge(member.date_of_birth)} years</TableCell>
                      <TableCell>Male</TableCell>
                      <TableCell>{new Date(member.date_of_birth).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {/* <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">Diabetes Type 2</Badge>
                          <Badge variant="secondary">Hypertension</Badge>
                          <span className="text-xs text-gray-500">+1</span>
                        </div> */}
                      </TableCell>
                      {/* <TableCell>{new Date(member.date_of_birth).toLocaleDateString()}</TableCell> */}
                      <TableCell>
                        <Badge variant="success" className="flex w-fit items-center gap-1">
                          <CheckCircleIcon className="h-3 w-3" />
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => openViewDialog(member)}
                            className="rounded p-1 hover:bg-gray-100"
                            title="View"
                        >
                          <EyeIcon className="h-4 w-4 text-gray-600" />
                          </button>
                          
                          {isValidAdmin && (
                          <>
                            <button
                              onClick={() => openEditDialog(member)}
                              className="rounded p-1 hover:bg-gray-100"
                              title="Edit"
                          >
                            <EditIcon className="h-4 w-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => openDeleteDialog(member)}
                            className="rounded p-1 hover:bg-gray-100"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4 text-gray-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Resident Dialog */}
      {isValidAdmin && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Resident</DialogTitle>
            <DialogDescription>
              Enter resident information to add them to the monitoring system.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-first-name">First Name</Label>
                  <Input
                    id="add-first-name"
                    placeholder="John"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-last-name">Last Name</Label>
                  <Input
                    id="add-last-name"
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-dob">Date of Birth</Label>
                <Input
                  id="add-dob"
                  type="date"
                  placeholder="dd/mm/yyyy"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-gender">Gender</Label>
                <Select 
                value={formData.gender} 
                onValueChange={(value: "male" | "female" | "other") => 
                  setFormData({...formData, gender: value})
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <div className="space-y-2">
                <Label>Health Conditions</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter health condition"
                    value={formData.new_condition}
                    onChange={(e) => setFormData({ ...formData, new_condition: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHealthCondition())}
                  />
                  <Button type="button" onClick={addHealthCondition} size="sm">
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
                {formData.health_conditions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.health_conditions.map((condition, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeHealthCondition(index)}
                      >
                        {condition} ×
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500">Click on a condition to remove it</p>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-black text-white hover:bg-gray-800">
                Add Resident
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )}

      {/* Edit Resident Dialog */}
      {isValidAdmin && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Resident</DialogTitle>
            <DialogDescription>Update resident information below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditMember}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">First Name</Label>
                  <Input
                    id="edit-first-name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Last Name</Label>
                  <Input
                    id="edit-last-name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dob">Date of Birth</Label>
                <Input
                  id="edit-dob"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gender">Gender</Label>
                <Select 
                  value={formData.gender} 
                  onValueChange={(value: "male" | "female" | "other") => 
                    setFormData({...formData, gender: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Health Conditions</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter health condition"
                    value={formData.new_condition}
                    onChange={(e) => setFormData({ ...formData, new_condition: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHealthCondition())}
                  />
                  <Button type="button" onClick={addHealthCondition} size="sm">
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
                {formData.health_conditions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.health_conditions.map((condition, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeHealthCondition(index)}
                      >
                        {condition} ×
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500">Click on a condition to remove it</p>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  resetForm();
                  setSelectedMember(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-black text-white hover:bg-gray-800">
                Update Resident
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )}

      {/* View Resident Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              <DialogTitle>Resident Details</DialogTitle>
            </div>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <div className="text-sm text-gray-500">
                Resident ID: {selectedMember.id}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">First Name</p>
                  <p className="text-base text-gray-900">{selectedMember.first_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Last Name</p>
                  <p className="text-base text-gray-900">{selectedMember.last_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                  <p className="text-base text-gray-900">
                    {new Date(selectedMember.date_of_birth).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Age</p>
                  <p className="text-base text-gray-900">
                    {calculateAge(selectedMember.date_of_birth)} years
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Gender</p>
                <p className="text-base text-gray-900">Male</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Health Conditions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">Diabetes Type 2</Badge>
                  <Badge variant="outline">Hypertension</Badge>
                  <Badge variant="outline">High Cholesterol</Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Registration Date</p>
                <p className="text-base text-gray-900">
                  {new Date(selectedMember.date_of_birth).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <Badge variant="success" className="mt-1 flex w-fit items-center gap-1">
                  <CheckCircleIcon className="h-3 w-3" />
                  Active
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {isValidAdmin && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedMember?.first_name} {selectedMember?.last_name}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedMember(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMember}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
        </div>
      </div>
    </AccessGuard>
  );
}

export default function MembersPage() {
  return (
    <Suspense>
      <UnsuspendedMembersPage />
    </Suspense>
  );
}
