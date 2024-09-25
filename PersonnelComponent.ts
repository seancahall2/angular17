
import {
    Component,
    ElementRef,
    HostListener,
    ViewChild,
    afterRender,
} from '@angular/core';
import { BsDropdownDirective } from 'ngx-bootstrap/dropdown';
import { PersonnelService } from './personnel.service';
import { ExcelExportService } from './excel-export.service';
import { SharedService } from '../shared.service';
import { lastValueFrom } from 'rxjs';
import { NavigationStart, Router } from '@angular/router';
import { BehaviorSubject, first } from 'rxjs';
import { RoleService } from './role.service';
import { SessionService } from '../session.service';
import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
    selector: 'uw-personnel',
    templateUrl: './personnel.component.html',
    styleUrl: './personnel.component.scss',
})

export class PersonnelComponent {
    @ViewChild('mydropdown', { static: false }) mydropdown:
        | ElementRef
        | undefined;
    width: number | undefined;
    height: number | undefined;
    currentSelection: any;
    selected?: string;
    placeholder = '';
    isClosed = false;
    loaded = false;
    personnel: any;
    personnelTitles: any;
    personnelReduced: any;
    personnelStatusID = 101;
    unitID = 0;
    selectedPerson: any;
    result: any;
    exportLabel: string = 'Include Titles?';
    titles: any;
    lastEvent = '';
    titleSubscription: any;
    personSubscription: any;
    sessionData: any;
    user: any;
    userName: string = '';

    constructor(
        @Inject(DOCUMENT) private document: Document,
        private personnelService: PersonnelService,
        private excelExportService: ExcelExportService,
        private sharedService: SharedService,
        private router: Router,
        private roleService: RoleService,
        private sessionService: SessionService
    ) { }

    @HostListener('window:resize', ['$event'])
    onResize(event: Event) {
        this.width = (event.target as Window).innerWidth;
        this.height = (event.target as Window).innerHeight;
        if (this.width && this.width <= 960 && !this.isClosed) {
            this.mydropdown?.nativeElement.click();
            this.isClosed = true;
        }
        if (this.width && this.width > 960 && this.isClosed) {
            this.mydropdown?.nativeElement.click();
            this.isClosed = false;
        }
    }

    ngOnInit() {
        let flag = false;
        this.personSubscription = this.personnelService
            .getPersonData()
            .pipe(first())
            .subscribe((value) => {
                if (value) {
                    flag = true;
                    this.personnel = this.sharedService.upperCaseKeys(value.person);
                    this.placeholder = this.setPlaceholder(
                        this.personnel.LastName + ', ' + this.personnel.FirstName,
                        this.personnel
                    );
                    this.personnelStatusID = value.params.personnelStatusId;
                    this.unitID = value.params.unitId;
                    (
                        this.document.getElementById('faculty-type') as HTMLInputElement
                    ).value = this.unitID.toString();
                    (
                        this.document.getElementById('faculty-status') as HTMLInputElement
                    ).value = this.personnelStatusID.toString();
                }
            });
        if (!flag) {
            this.titleSubscription = this.roleService
                .getTitleData()
                .subscribe((value) => {
                    if (value && value.person && value.titles) {
                        this.personnel = this.sharedService.upperCaseKeys(value.person);
                        this.placeholder = this.setPlaceholder(
                            this.personnel.LastName + ', ' + this.personnel.FirstName,
                            this.personnel
                        );
                        this.titles = value.titles;
                        this.personnelStatusID = value.params.personnelStatusId;
                        if (!this.personnelStatusID) {
                            this.personnelStatusID = 101;
                        }
                        this.unitID = value.params.unitId;
                        if (!this.unitID) {
                            this.unitID = 0;
                        }
                        (
                            this.document.getElementById('faculty-type') as HTMLInputElement
                        ).value = this.unitID.toString();
                        (
                            this.document.getElementById('faculty-status') as HTMLInputElement
                        ).value = this.personnelStatusID.toString();
                    }
                });
        }
        if (
            this.document.location.host &&
            this.document.location.host !== 'localhost:4200'
        ) {
            try {
                this.sessionService.getUserSession().subscribe((session: any) => {
                    if (session) {
                        if (
                            session.attributes &&
                            session.attributes.length > 2 &&
                            session.attributes[2].values[0]
                        ) {
                            this.userName = this.sessionData.attributes[2].values[0];
                        }
                    } else {
                        console.log('No Session Data.');
                    }
                });
            } catch (error) {
                console.error('Error:', error);
            }
        }
        if (!this.personnelStatusID) {
            this.personnelStatusID = 101;
        }
        (this.document.getElementById('faculty-status') as HTMLInputElement).value =
            this.personnelStatusID.toString();
        if (!this.unitID) {
            this.unitID = 0;
        }
        (this.document.getElementById('faculty-type') as HTMLInputElement).value =
            this.unitID.toString();
        this.getPersonnel(this.personnelStatusID, this.unitID);
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.mydropdown?.nativeElement.click();
        }, 1000);
    }

    setSelection(item: any) {
        const links = this.document.querySelectorAll('li');
        for (let i = 0; i < links.length; i++) {
            if (links[i].innerText === item) {
                links[i].scrollIntoView();
                links[i].focus();
                links[i].click();
                links[i].classList.add('selected');
                this.currentSelection = links[i];
            }
        }
    }

    onClick(person: any) {
        if (
            this.currentSelection &&
            this.currentSelection.classList &&
            this.currentSelection.classList.contains('selected')
        ) {
            this.currentSelection.classList.remove('selected');
        } else {
            this.currentSelection = person;
        }
        const facultySearch = this.document.getElementById(
            'faculty-search'
        ) as HTMLInputElement;
        if (facultySearch) {
            facultySearch.value = '';
        }
        this.placeholder = this.setPlaceholder(person.FullName, person);
    }

    changeItemBackground(item: any) {
        const links = this.document.querySelectorAll('li');
        for (let i = 0; i < links.length; i++) {
            if (links[i].innerText === item) {
                links[i].classList.remove(...Array.from(links[i].classList));
                links[i].classList.add('selected');
            }
        }
    }

    doReport() {
        this.router.navigate(['/titles', this.personnelStatusID, this.unitID]);
    }

    viewImports() {
        this.router.navigate(['/titles']);
    }

    typeaheadOnSelect(e: any) {
        this.selected = e;
        this.setSelection(e.value);
        this.placeholder = this.setPlaceholder(e.value, e.item);
    }

    setPlaceholder(name: any, person: any) {
        const result = name + ' (#' + person.PersonnelId + ')';
        this.selectedPerson = person;
        this.selectedPerson.UWEmpNo = person.UwempNo;
        this.selectedPerson.UWNetID = person.UwnetId;
        this.selectedPerson.PersonnelID = person.PersonnelId;
        return result;
    }

    doExport() {
        this.personnelReduced = this.removeSuperfluousColumns(this.personnel);
        this.excelExportService.exportAsExcelFile(
            this.personnelReduced,
            'personnel'
        );
        this.router.navigate(['/titles', this.personnelStatusID, this.unitID]);
    }

    async getPersonnel(personnelStatusID: number, unitID: number) {
        await lastValueFrom(
            this.personnelService.getPersonnelDetail(personnelStatusID, unitID)
        )
            .then((data: any) => {
                this.personnel = data.$values.map((item: any) =>
                    this.sharedService.upperCaseKeys(item)
                );
            })
            .catch((e: any) => {
                this.sharedService.showToast('Error Getting Personnel.', 'error');
            });
    }

    updatePersonnelList(param: any, option: any) {
        param === 'status'
            ? (this.personnelStatusID = option.target.value)
            : (this.unitID = option.target.value);
        this.getPersonnel(this.personnelStatusID, this.unitID);
    }

    loadDropdowns(person: any) {
        if (person) {
            let personnel = this.sharedService.upperCaseKeys(person);
            personnel.FullName = personnel.LastName + ', ' + personnel.FirstName;
            personnel.PersonnelID = personnel.PersonnelId
                ? personnel.PersonnelId
                : personnel.PersonnelID;
            personnel.UWEmpNo = personnel.UwempNo
                ? personnel.UwempNo
                : personnel.UWEmpNo;
            personnel.UWNetID = personnel.UwnetId
                ? personnel.UwnetId
                : personnel.UWNetID;
            personnel.EDirectoryEntry = personnel.EdirectoryEntry;
            this.getPersonnel(this.personnelStatusID, this.unitID);
            this.placeholder = this.setPlaceholder(personnel.FullName, personnel);
        }
    }

    removeSuperfluousColumns(data: any) {
        data.forEach(
            (p: {
                Faculty: any;
                Student: any;
                Staff: any;
                PersonnelUnitDTOs: any;
                PersonStartDate: any;
                PersonEndDate: any;
            }) => {
                delete p.Faculty;
                delete p.Student;
                delete p.Staff;
                delete p.PersonnelUnitDTOs;
                p.PersonStartDate = new Date(p.PersonStartDate).toLocaleDateString();
                p.PersonEndDate = new Date(p.PersonEndDate).toLocaleDateString();
            }
        );
        return data;
    }

    ngOnDestroy() {
        this.personSubscription.unsubscribe();
        if (this.titleSubscription) {
            this.titleSubscription.unsubscribe();
        }
        this.personnelService.setPersonData(null);
    }
}
