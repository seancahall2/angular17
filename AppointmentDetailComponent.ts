import {
    Component,
    Input,
    SimpleChange,
    TemplateRef,
    Output,
    EventEmitter,
    ViewChild,
} from '@angular/core';
import { PersonnelService } from '../personnel.service';
import { SharedService } from '../../shared.service';
import { SessionService } from '../../session.service';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';

import {
    FormGroup,
    FormBuilder,
    FormControl,
    ReactiveFormsModule,
} from '@angular/forms';
import { Personnel } from '../personnel';
import { catchError, lastValueFrom, of } from 'rxjs';
import { ModalPopup } from '../../modal/modal-popup';
import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
    selector: 'uw-appointment-detail',
    templateUrl: './appointment-detail.component.html',
    styleUrl: './appointment-detail.component.scss',
}) export class AppointmentDetailComponent {
    @Input() selectedPerson: any;
    data: any;
    items: any;
    loaded: boolean = false;
    roles: any;
    rooms: any;
    personForm: FormGroup | any;
    isEdit: boolean = false;
    submitLabel: string = 'Add Person';
    datadog: any;
    modalRef: BsModalRef | undefined;
    person: Personnel = new Personnel();
    @Output() newPersonEvent = new EventEmitter<Personnel>();
    newModalEvent: {} | undefined;
    roomNumber: number = 0;
    creationDate: Date = new Date();
    appName: string = 'PersonnelDB';
    userName: string = '';
    lastUpdated: any;

    @ViewChild('template') template: TemplateRef<any> | undefined;
    constructor(
        @Inject(DOCUMENT) private document: Document,
        private personnelService: PersonnelService,
        private formBuilder: FormBuilder,
        private sharedService: SharedService,
        private modalService: BsModalService,
        private sessionService: SessionService
    ) {
        this.setUpForm();
    }

    openModal(template: TemplateRef<any>) {
        this.modalRef = this.modalService.show(template);
    }

    ngOnInit() {
        this.getRooms();
        try {
            this.sessionService.getUserSession().subscribe((session: any) => {
                if (session) {
                    let sessionData = session;
                    if (
                        session.attributes &&
                        session.attributes.length > 2 &&
                        session.attributes[2].values[0]
                    ) {
                        this.userName = session.attributes[2].values[0];
                    }
                } else {
                    console.log('No Session Data.');
                }
            });
        } catch (error) {
            console.error('Error:', error);
        }
    }

    ngOnChanges(changes: { [propertyName: string]: SimpleChange }) {
        this.populateForm();
    }

    refreshPersonnel(person: Personnel) {
        this.newPersonEvent.emit(person);
    }

    setUpForm() {
        this.personForm = this.formBuilder.group({
            FirstName: [''],
            LastName: [''],
            MiddleName: [''],
            PreferredName: [''],
            UWEmpNo: [''],
            UWNetID: [''],
            Title: [''],
            PersonStartDate: [''],
            PersonEndDate: [undefined],
            RoomNumber: ['0'],
            PersonPhone: [''],
            PersonEmail: [''],
            WebDirectory: [false],
            EDirectoryEntry: [false],
            PersonWeb: [''],
        });
    }

    populateForm() {
        if (this.selectedPerson) {
            this.isEdit = true;
            this.personForm.patchValue(this.selectedPerson);
            this.personForm.controls['PersonStartDate'].setValue(
                new Date(this.selectedPerson.PersonStartDate)
            );
            if (this.selectedPerson.PersonEndDate) {
                this.personForm.controls['PersonEndDate'].setValue(
                    new Date(this.selectedPerson.PersonEndDate)
                );
            }
            if (this.selectedPerson && this.selectedPerson.RoomNumber && this.rooms) {
                this.changeRoomSelected(this.selectedPerson.RoomNumber);
            }
            if (
                this.selectedPerson &&
                this.selectedPerson.RoomNumber &&
                !this.rooms
            ) {
                setTimeout(() => {
                    this.populateForm();
                }, 250);
            }
            if (!this.selectedPerson.RoomNumber) {
                this.changeRoomSelected(0);
            }
            this.submitLabel = 'Update';
            if (
                this.selectedPerson.CreationUser ||
                this.selectedPerson.MaintenanceUser
            ) {
                const uwnetId = this.selectedPerson.MaintenanceUser
                    ? this.selectedPerson.MaintenanceUser
                    : this.selectedPerson.CreationUser;
                if (uwnetId) {
                    const lastUpdateDate = this.selectedPerson.MaintenanceDate
                        ? this.selectedPerson.MaintenanceDate
                        : this.selectedPerson.CreationDate;
                    this.getCurrentUser(uwnetId, lastUpdateDate);
                }
            }
        }
    }

    async getCurrentUser(uwnetId: any, lastUpdateDate: any) {
        await lastValueFrom(this.personnelService.getPersonnelByUWnetId(uwnetId))
            .then((data: any) => {
                if (data) {
                    this.lastUpdated = {
                        firstName: data.preferredName ? data.preferredName : data.firstName,
                        lastName: data.lastName,
                        date: lastUpdateDate,
                        uwnetId: uwnetId,
                    };
                    // console.log('lastupdated', this.lastUpdated);
                }
            })
            .catch((e: any) => {
                this.sharedService.showToast('Error Getting Last Updated.', 'error');
            });
    }

    async getRooms() {
        await lastValueFrom(this.personnelService.getRooms())
            .then((data: any) => {
                this.rooms = data.$values;
                const firstOption = {
                    $id: '0',
                    roomNumber: '-- Select Room --',
                };
                this.rooms.unshift(firstOption);
                this.changeRoomSelected(0);
            })
            .catch((e: any) => {
                this.sharedService.showToast('Error Getting Rooms.', 'error');
            });
    }

    changeRoomSelected = (id: any) => {
        let result = id;
        if (id != 0) {
            result = this.parse$id(id);
        }
        const myselect = this.document.getElementById(
            'RoomNumber'
        ) as HTMLSelectElement;
        if (myselect) {
            myselect.value = result;
        }
    };

    onSubmit() {
        let person = this.personForm.value;
        if (this.selectedPerson) {
            person.PersonnelID = this.selectedPerson.PersonnelID;
        }
        if (person.PersonStartDate) {
            person.PersonStartDate = new Date(person.PersonStartDate).toISOString();
        }
        if (person.PersonEndDate) {
            person.PersonEndDate = new Date(person.PersonEndDate).toISOString();
        }
        if (this.isEdit) {
            this.checkUpdateForDupes(person);
        } else {
            this.checkForDupes(person);
        }
    }

    checkUpdateForDupes(person: any) {
        this.personnelService
            .checkForDupes(person.FirstName, person.LastName)
            .subscribe((data: any) => {
                if (
                    data &&
                    data.$values &&
                    data.$values.length > 0 &&
                    data.$values[0].personnelId != person.PersonnelID
                ) {
                    this.sharedService.showToast(
                        'Update Failed! A record already exists with this first and last name.',
                        'error'
                    );
                } else {
                    this.updatePerson(person);
                }
            });
    }

    async checkForDupes(person: Personnel) {
        await lastValueFrom(
            this.personnelService.checkForDupes(person.FirstName, person.LastName)
        )
            .then((data: any) => {
                if (data && data.$values && data.$values.length > 0) {
                    this.person = data.$values[0];
                    let modalPopup: ModalPopup = new ModalPopup();
                    modalPopup.header = 'Duplicate Record Found';
                    modalPopup.type = 'duplicate';
                    modalPopup.message =
                        'A person already exists with that first and last name. Would you like to edit this record instead?';
                    this.newModalEvent = modalPopup;
                    if (this.template) {
                        this.openModal(this.template);
                    }
                } else {
                    this.addPerson(person);
                }
            })
            .catch((e: any) => {
                this.sharedService.showToast('Error Checking for Duplicates.', 'error');
            });
    }

    resetForm() {
        this.personForm.reset();
        this.changeRoomSelected(0);
        this.isEdit = false;
        this.submitLabel = 'Add Person';
    }

    modalEvent(event: any) {
        if (event == 1) {
            this.refreshPersonnel(this.person);
        }
        this.modalService.hide();
    }

    maskPhoneNo() {
        let el = document.querySelector('#PersonPhone') as HTMLInputElement;
        let pnum = el.value.replace(/\D*/g, '');
        if (pnum.length >= 3) {
            pnum = '(' + pnum.slice(0, 3) + ') ' + pnum.slice(3);
        }
        if (pnum.length >= 9) {
            pnum = pnum.slice(0, 9) + '-' + pnum.slice(9);
        }
        el.value = pnum;
    }

    addPerson(person: Personnel) {
        person.RoomNumber = this.parseRoomNumber(person.RoomNumber);
        person.Faculty = false;
        person.Staff = false;
        person.Student = false;
        person.CreationUser = this.userName;
        person.CreationApp = this.appName;
        this.personnelService
            .addPersonnel(person)
            .pipe(
                catchError((e: any) => {
                    const errorMsg = this.sharedService.parseError(e);
                    this.sharedService.showToast(errorMsg, 'error');
                    return of(null);
                })
            )
            .subscribe((data: any) => {
                if (data) {
                    this.sharedService.showToast('Person Added!', 'success');
                    this.refreshPersonnel(data);
                }
            });
    }

    updatePerson(person: Personnel) {
        person.RoomNumber = this.parseRoomNumber(person.RoomNumber);
        person.MaintenanceDate = new Date().toISOString();
        person.MaintenanceUser = this.userName;
        person.MaintenanceApp = this.appName;
        this.personnelService
            .updatePersonnel(person)
            .pipe(
                catchError((e: any) => {
                    this.sharedService.showToast('Error Updating Person.', 'error');
                    return of(null);
                })
            )
            .subscribe((data: any) => {
                if (data) {
                    this.sharedService.showToast('Person Updated!', 'success');
                    this.refreshPersonnel(data);
                }
            });
    }

    async deletePersonnel(id: number) {
        await lastValueFrom(this.personnelService.deletePersonnel(id))
            .then((data: any) => {
                this.sharedService.showToast('Person Deleted!', 'success');
                this.refreshPersonnel(data);
            })
            .catch((e: any) => {
                this.sharedService.showToast('Error Deleting Person.', 'error');
            });
    }

    validateEmail() {
        const validRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (this.personForm.controls['PersonEmail'].value.match(validRegex)) {
            return true;
        } else {
            if (this.personForm.controls['PersonEmail'].value.length > 0) {
                let modalPopup: ModalPopup = new ModalPopup();
                modalPopup.header = 'Invalid Email Address';
                modalPopup.type = 'error';
                modalPopup.message = 'Please enter a valid email address!';
                this.newModalEvent = modalPopup;
                if (this.template) {
                    this.openModal(this.template);
                }
                this.personForm.controls['PersonEmail'].value = '';
                document.getElementById('PersonEmail')?.focus();
                return false;
            } else {
                return true;
            }
        }
    }

    parseRoomNumber(id: any) {
        let roomNumber = '0';
        if (id === '0') {
            return roomNumber;
        }
        if (this.rooms) {
            const roomObject = this.rooms.find((r: any) => r.$id === id);
            if (roomObject) {
                return roomObject.roomNumber;
            }
        }
    }

    parse$id(roomNumber: any) {
        if (roomNumber === null) {
            return 0;
        }
        if (this.rooms) {
            const roomObject = this.rooms.find(
                (r: any) => r.roomNumber === roomNumber
            );
            if (roomObject) {
                return roomObject.$id;
            }
        }
    }
}
