import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield, Trash2, Smartphone, Laptop, Globe, Download, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useResetData } from '../hooks/useQueries';
import { toast } from 'sonner';
import api from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface Session {
  id: string;
  device: string | null;
  ip: string | null;
  lastActive: string;
  isCurrent: boolean;
}

export function ProfileTab() {
  const { user, logout } = useAuth();
  const resetData = useResetData();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [updateProfileLoading, setUpdateProfileLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [revokePasswordOpen, setRevokePasswordOpen] = useState(false);
  const [revokePassword, setRevokePassword] = useState('');

  // Fetch Sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/auth/sessions');
      return res.data;
    },
  });

  const currentSession = sessions?.find(s => s.isCurrent);
  const otherSessions = sessions?.filter(s => !s.isCurrent) || [];

  // Revoke Session Mutation
  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/auth/sessions/${sessionId}`);
    },
    onSuccess: () => {
      toast.success('Session revoked');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: () => {
      toast.error('Failed to revoke session');
    },
  });

  // Revoke Others Mutation
  const revokeOthers = useMutation({
    mutationFn: async (password: string) => {
      await api.delete('/auth/sessions/others', { data: { password } });
    },
    onSuccess: () => {
      toast.success('All other sessions revoked');
      setRevokePasswordOpen(false);
      setRevokePassword('');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to revoke sessions');
    },
  });

  const handleRevokeOthersClick = () => {
    setRevokePassword('');
    setRevokePasswordOpen(true);
  };

  const confirmRevokeOthers = (e: React.FormEvent) => {
    e.preventDefault();
    if (revokePassword) {
      revokeOthers.mutate(revokePassword);
    }
  };

  const handleResetData = async () => {
    try {
      await resetData.mutateAsync();
      toast.success('All data has been reset successfully');
    } catch (error) {
      toast.error('Failed to reset data');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setUpdateProfileLoading(true);
    try {
      await api.put('/auth/me', { name: editName });
      toast.success('Profile updated successfully');
      setEditNameOpen(false);
      // Ideally refetch user here, but for now we rely on page refresh or context update if available
      // Assuming useAuth provides a way to refresh user or we just reload
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setUpdateProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated successfully');
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/auth/delete-account');
      toast.success('Account deleted successfully');
      logout();
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="flex flex-col items-start justify-between gap-6 rounded-panel border border-border bg-card p-5 shadow-panel sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <Avatar className="h-16 w-16 border border-border bg-primary-soft shadow-xs">
            <AvatarFallback className="bg-primary-soft font-mono text-lg font-semibold text-primary-strong">{user.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">{user.name || 'User'}</h2>
              <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-primary" onClick={() => setEditName(user.name || '')} aria-label="Edit display name">
                    <User className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>Update your display name.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Display Name</Label>
                      <Input id="name" value={editName} onChange={e => setEditName(e.target.value)} required autoFocus />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={updateProfileLoading}>
                        {updateProfileLoading ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center text-muted-foreground">
              <Mail className="mr-2 h-4 w-4" />
              {user.email}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 px-2 py-0.5">
                Active Account
              </Badge>
              <span className="text-xs text-muted-foreground">Joined {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Main Settings Column */}
        <div className="md:col-span-2 space-y-8">

          {/* Sessions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Active Sessions
              </h3>
              {otherSessions.length > 0 && (
                <Dialog open={revokePasswordOpen} onOpenChange={setRevokePasswordOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleRevokeOthersClick} className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10">
                      Revoke All Others
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Revoke All Other Sessions</DialogTitle>
                      <DialogDescription>
                        Please enter your password to confirm logging out all other devices.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={confirmRevokeOthers} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="revoke-password">Password</Label>
                        <Input
                          id="revoke-password"
                          type="password"
                          value={revokePassword}
                          onChange={(e) => setRevokePassword(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit" variant="destructive" disabled={revokeOthers.isPending}>
                          {revokeOthers.isPending ? 'Revoking...' : 'Revoke All Others'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {sessionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Session */}
                {currentSession && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Current Device</h4>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-full text-primary-strong">
                          {currentSession.device?.toLowerCase().includes('mobile') ? (
                            <Smartphone className="h-6 w-6" />
                          ) : (
                            <Laptop className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{currentSession.device || 'Unknown Device'}</p>
                            <Badge className="bg-primary text-primary-foreground hover:bg-primary">You</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <Globe className="h-3 w-3" />
                            <span>{currentSession.ip || 'Unknown IP'}</span>
                            <span>•</span>
                            <span className="text-success font-medium">Active Now</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Desktop Sessions */}
                {otherSessions.filter(s => !s.device?.toLowerCase().includes('mobile')).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Desktop Devices</h4>
                    <div className="space-y-3">
                      {otherSessions.filter(s => !s.device?.toLowerCase().includes('mobile')).map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-all">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-secondary rounded-full text-muted-foreground">
                              <Laptop className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{session.device || 'Unknown Device'}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                                <Globe className="h-3 w-3" />
                                <span>{session.ip || 'Unknown IP'}</span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(session.lastActive))} ago</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeSession.mutate(session.id)}
                            disabled={revokeSession.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobile Sessions */}
                {otherSessions.filter(s => s.device?.toLowerCase().includes('mobile')).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Mobile Devices</h4>
                    <div className="space-y-3">
                      {otherSessions.filter(s => s.device?.toLowerCase().includes('mobile')).map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-all">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-secondary rounded-full text-muted-foreground">
                              <Smartphone className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{session.device || 'Unknown Device'}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                                <Globe className="h-3 w-3" />
                                <span>{session.ip || 'Unknown IP'}</span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(session.lastActive))} ago</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeSession.mutate(session.id)}
                            disabled={revokeSession.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Security Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Password</span>
                  <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">Change</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>Enter your current password and a new password.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="current">Current Password</Label>
                          <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new">New Password</Label>
                          <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm">Confirm New Password</Label>
                          <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={passwordLoading}>
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-xs text-muted-foreground">Last changed: Never</p>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="border-destructive/20 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your transactions, accounts, and investments. Your user account will remain.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, Reset Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action is irreversible. It will permanently delete your account and ALL your data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Data Management Card */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start" onClick={async () => {
                try {
                  const response = await api.get('/user/export', { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `fintrack_backup_${new Date().toISOString().split('T')[0]}.json`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                  toast.success('Data exported successfully');
                } catch (e) {
                  toast.error('Failed to export data');
                }
              }}>
                <Download className="mr-2 h-4 w-4" />
                Export All Data
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (!confirm('Importing data will create NEW accounts and transactions. It does not check for duplicates. Are you sure you want to proceed?')) {
                      e.target.value = '';
                      return;
                    }

                    const formData = new FormData();
                    formData.append('file', file);

                    const toastId = toast.loading('Importing data...');
                    try {
                      await api.post('/user/import', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      toast.success('Data imported successfully', { id: toastId });
                      window.location.reload();
                    } catch (error) {
                      toast.error('Failed to import data', { id: toastId });
                    }
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div >
  );
}
